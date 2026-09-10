import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getCurrentUserId } from '@/lib/auth/current-user'

export const EXPORT_SCHEMA_VERSION = 1

/**
 * Tables in dependency order. Export walks it forwards; import walks it
 * forwards too, so a parent row always exists before its children (spec 33).
 */
export const EXPORT_TABLES = [
  'user_settings',
  'custom_metrics',
  'daily_logs',
  'custom_metric_values',
  'habits',
  'habit_logs',
  'goals',
  'goal_milestones',
  'topics',
  'projects',
  'project_tasks',
  'focus_sessions',
  'resources',
  'workouts',
  'workout_sets',
  'body_measurements',
  'nutrition_logs',
  'accounts',
  'finance_categories',
  'transactions',
  'recurring_transactions',
  'budgets',
  'assets',
  'investments',
  'notes',
  'tags',
  'note_tags',
  'note_links',
  'journal_entries',
  'events',
  'planned_blocks',
  'people',
  'interactions',
  'reminders',
  'skills',
  'achievements',
  'portfolio_items',
  'weekly_reviews',
  'monthly_reviews',
  'yearly_reviews',
  'ai_reports',
] as const

export type ExportTable = (typeof EXPORT_TABLES)[number]

/** Child tables reached through a parent, so they filter by the parent's id. */
const CHILD_TABLES: Partial<Record<ExportTable, { parent: ExportTable; foreignKey: string; parentKey: string }>> = {
  custom_metric_values: { parent: 'daily_logs', foreignKey: 'daily_log_id', parentKey: 'id' },
  goal_milestones: { parent: 'goals', foreignKey: 'goal_id', parentKey: 'id' },
  workout_sets: { parent: 'workouts', foreignKey: 'workout_id', parentKey: 'id' },
  note_tags: { parent: 'notes', foreignKey: 'note_id', parentKey: 'id' },
  note_links: { parent: 'notes', foreignKey: 'source_note_id', parentKey: 'id' },
}

export type ExportPayload = {
  schemaVersion: number
  exportedAt: string
  app: string
  tables: Record<string, Record<string, unknown>[]>
}

/**
 * Full JSON dump of everything this user owns. Portability is a hard
 * requirement, not a backlog item: the data must be removable at any time.
 */
export async function buildExport(): Promise<ExportPayload> {
  const userId = await getCurrentUserId()
  const tables: ExportPayload['tables'] = {}

  for (const table of EXPORT_TABLES) {
    const child = CHILD_TABLES[table]

    const rows = child
      ? await db.execute(
          sql`SELECT c.* FROM ${sql.identifier(table)} c
              JOIN ${sql.identifier(child.parent)} p ON p.${sql.identifier(child.parentKey)} = c.${sql.identifier(child.foreignKey)}
              WHERE p.user_id = ${userId}`,
        )
      : await db.execute(sql`SELECT * FROM ${sql.identifier(table)} WHERE user_id = ${userId}`)

    tables[table] = rows as unknown as Record<string, unknown>[]
  }

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'personal-os',
    tables,
  }
}

export type ImportSummary = {
  ok: boolean
  schemaVersion?: number
  inserted: Record<string, number>
  skipped: Record<string, number>
  errors: string[]
  dryRun: boolean
}

/**
 * Import is additive and id-preserving: a row whose primary key already exists
 * is skipped rather than overwriting local data, and every row is re-owned by
 * the current user. `dryRun` reports what would happen without writing.
 */
export async function importPayload(payload: unknown, dryRun: boolean): Promise<ImportSummary> {
  const summary: ImportSummary = { ok: false, inserted: {}, skipped: {}, errors: [], dryRun }

  if (typeof payload !== 'object' || payload === null) {
    summary.errors.push('payload is not an object')
    return summary
  }

  const parsed = payload as Partial<ExportPayload>
  if (parsed.app !== 'personal-os') summary.errors.push('not a Personal OS export')
  if (typeof parsed.schemaVersion !== 'number') summary.errors.push('missing schemaVersion')
  if (parsed.schemaVersion && parsed.schemaVersion > EXPORT_SCHEMA_VERSION) {
    summary.errors.push(`export is newer (v${parsed.schemaVersion}) than this app`)
  }
  if (!parsed.tables || typeof parsed.tables !== 'object') summary.errors.push('missing tables')
  if (summary.errors.length > 0) return summary

  summary.schemaVersion = parsed.schemaVersion
  const userId = await getCurrentUserId()

  for (const table of EXPORT_TABLES) {
    const rows = parsed.tables?.[table]
    if (!Array.isArray(rows) || rows.length === 0) continue

    let inserted = 0
    let skipped = 0

    for (const row of rows) {
      if (typeof row !== 'object' || row === null) {
        skipped += 1
        continue
      }

      const values: Record<string, unknown> = { ...(row as Record<string, unknown>) }
      if ('user_id' in values) values.user_id = userId

      if (dryRun) {
        inserted += 1
        continue
      }

      try {
        const columns = Object.keys(values)
        const columnSql = sql.join(
          columns.map((column) => sql.identifier(column)),
          sql`, `,
        )
        const valueSql = sql.join(
          columns.map((column) => sql`${values[column] as never}`),
          sql`, `,
        )

        await db.execute(
          sql`INSERT INTO ${sql.identifier(table)} (${columnSql}) VALUES (${valueSql}) ON CONFLICT DO NOTHING`,
        )
        inserted += 1
      } catch (error) {
        skipped += 1
        if (summary.errors.length < 20) {
          summary.errors.push(`${table}: ${error instanceof Error ? error.message : 'failed'}`)
        }
      }
    }

    summary.inserted[table] = inserted
    summary.skipped[table] = skipped
  }

  summary.ok = true
  return summary
}

/** Per-module CSV, for spreadsheets rather than round-tripping. */
export async function buildCsv(table: ExportTable): Promise<string> {
  const userId = await getCurrentUserId()
  const rows = (await db.execute(
    sql`SELECT * FROM ${sql.identifier(table)} WHERE user_id = ${userId}`,
  )) as unknown as Record<string, unknown>[]

  if (rows.length === 0) return ''

  const columns = Object.keys(rows[0] ?? {})
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return ''
    const text = value instanceof Date ? value.toISOString() : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  return [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => escape(row[column])).join(',')),
  ].join('\n')
}
