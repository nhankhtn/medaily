import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

export type SearchHit = {
  type: 'note' | 'journal' | 'daily' | 'task' | 'project' | 'goal' | 'person'
  id: string
  title: string
  snippet: string | null
  date: string | null
  href: string
}

/**
 * Spec 22.4 — one query across every text-bearing module. Notes and journal use
 * the maintained `tsvector`; the rest use ILIKE on a folded copy, which is fast
 * enough at personal scale and keeps the accent-insensitivity consistent.
 */
export async function searchEverything(
  userId: string,
  query: string,
  limit = 40,
): Promise<SearchHit[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const rows = await db.execute<{
    type: SearchHit['type']
    id: string
    title: string
    snippet: string | null
    date: string | null
  }>(sql`
    WITH q AS (
      SELECT
        websearch_to_tsquery('simple', f_unaccent(${trimmed})) AS tsq,
        '%' || f_unaccent(lower(${trimmed})) || '%'            AS pattern
    )
    SELECT 'note' AS type, n.id::text, n.title,
           left(coalesce(n.body_md, ''), 160) AS snippet,
           to_char(n.updated_at, 'YYYY-MM-DD') AS date
    FROM notes n, q
    WHERE n.user_id = ${userId} AND n.search_tsv @@ q.tsq

    UNION ALL
    SELECT 'journal', j.id::text, coalesce(j.title, j.entry_date::text),
           left(j.body_md, 160), j.entry_date::text
    FROM journal_entries j, q
    WHERE j.user_id = ${userId} AND j.search_tsv @@ q.tsq

    UNION ALL
    SELECT 'daily', d.id::text, d.log_date::text,
           left(concat_ws(' · ', d.daily_win, d.daily_problem, d.note), 160), d.log_date::text
    FROM daily_logs d, q
    WHERE d.user_id = ${userId}
      AND f_unaccent(lower(concat_ws(' ', d.daily_win, d.daily_problem, d.tomorrow_priority, d.note)))
          LIKE q.pattern

    UNION ALL
    SELECT 'task', t.id::text, t.title, null, t.due_date::text
    FROM project_tasks t, q
    WHERE t.user_id = ${userId} AND f_unaccent(lower(t.title)) LIKE q.pattern

    UNION ALL
    SELECT 'project', p.id::text, p.name, left(coalesce(p.description, ''), 160), null
    FROM projects p, q
    WHERE p.user_id = ${userId}
      AND f_unaccent(lower(concat_ws(' ', p.name, p.description))) LIKE q.pattern

    UNION ALL
    SELECT 'goal', g.id::text, g.name, left(coalesce(g.description, ''), 160), null
    FROM goals g, q
    WHERE g.user_id = ${userId}
      AND f_unaccent(lower(concat_ws(' ', g.name, g.description))) LIKE q.pattern

    UNION ALL
    SELECT 'person', pe.id::text, pe.name, left(coalesce(pe.notes, ''), 160), null
    FROM people pe, q
    WHERE pe.user_id = ${userId}
      AND f_unaccent(lower(concat_ws(' ', pe.name, pe.company, pe.notes))) LIKE q.pattern

    LIMIT ${limit}
  `)

  return rows.map((row) => ({
    ...row,
    href: hrefFor(row.type, row.id, row.date),
  }))
}

function hrefFor(type: SearchHit['type'], id: string, date: string | null): string {
  switch (type) {
    case 'note':
      return `/knowledge?note=${id}`
    case 'journal':
      return `/journal?entry=${id}`
    case 'daily':
      return date ? `/daily/${date}` : '/daily'
    case 'task':
    case 'project':
      return `/projects`
    case 'goal':
      return '/goals'
    case 'person':
      return '/people'
  }
}
