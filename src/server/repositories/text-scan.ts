import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

/**
 * Reading free text back out of the database without knowing which column it
 * was written to.
 *
 * Most lookups name their table and their columns, and belong in the
 * repository for that table. These two do not: what they are asked is whether
 * a string appears *anywhere* a person has typed, which is a question about
 * the schema rather than about any one table in it.
 */

/**
 * The character-typed columns of every table, so a caller can search text
 * without listing the fields that hold it.
 *
 * Character types only. Casting a whole row to text also renders generated
 * `tsvector` columns, and a tsvector lower-cases its lexemes — the same string
 * then comes back a second time in a form nobody wrote.
 */
export async function textColumnsByTable(): Promise<Map<string, string[]>> {
  const rows = (await db.execute(
    sql`SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type IN ('text', 'character varying', 'character')
        ORDER BY table_name, ordinal_position`,
  )) as unknown as { table_name: string; column_name: string }[]

  const byTable = new Map<string, string[]>()
  for (const row of rows) {
    byTable.set(row.table_name, [...(byTable.get(row.table_name) ?? []), row.column_name])
  }
  return byTable
}

/**
 * Every matching row's text in one string, or null when no row matches.
 *
 * `pattern` is a SQL `LIKE` pattern. Returning the text rather than the rows
 * is deliberate: the caller wants what was written, not which record wrote it.
 */
export async function findTextMatching(
  table: string,
  columns: string[],
  pattern: string,
): Promise<string | null> {
  if (columns.length === 0) return null

  const joined = sql.join(
    columns.map((column) => sql`coalesce(${sql.identifier(column)}, '')`),
    sql` || ' ' || `,
  )

  const rows = (await db.execute(
    sql`SELECT string_agg(text_of, ' ') AS blob
        FROM (SELECT ${joined} AS text_of FROM ${sql.identifier(table)}) rows
        WHERE text_of LIKE ${pattern}`,
  )) as unknown as { blob: string | null }[]

  return rows[0]?.blob ?? null
}
