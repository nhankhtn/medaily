import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

/**
 * Who a referenced row belongs to, asked of the schema rather than of any one
 * table — the import path needs it for every table it writes, and a list kept
 * by hand would miss the next foreign key someone adds.
 */

export type ForeignKey = { column: string; refTable: string; refColumn: string }

/**
 * Single-column foreign keys of the given tables, except those pointing at
 * `users`: an owner column is rewritten to the importer, never checked.
 */
export async function foreignKeysOf(tables: readonly string[]): Promise<Map<string, ForeignKey[]>> {
  if (tables.length === 0) return new Map()

  const rows = (await db.execute(
    sql`SELECT src.relname AS table_name, src_col.attname AS column_name,
               ref.relname AS ref_table, ref_col.attname AS ref_column
        FROM pg_constraint c
        JOIN pg_class src ON src.oid = c.conrelid
        JOIN pg_namespace ns ON ns.oid = src.relnamespace
        JOIN pg_class ref ON ref.oid = c.confrelid
        JOIN pg_attribute src_col ON src_col.attrelid = c.conrelid AND src_col.attnum = c.conkey[1]
        JOIN pg_attribute ref_col ON ref_col.attrelid = c.confrelid AND ref_col.attnum = c.confkey[1]
        WHERE c.contype = 'f'
          AND ns.nspname = 'public'
          AND array_length(c.conkey, 1) = 1
          AND ref.relname <> 'users'
          AND src.relname IN (${sql.join(
            tables.map((table) => sql`${table}`),
            sql`, `,
          )})
        ORDER BY src.relname, src_col.attname, c.oid`,
  )) as unknown as {
    table_name: string
    column_name: string
    ref_table: string
    ref_column: string
  }[]

  const byTable = new Map<string, ForeignKey[]>()
  for (const row of rows) {
    byTable.set(row.table_name, [
      ...(byTable.get(row.table_name) ?? []),
      { column: row.column_name, refTable: row.ref_table, refColumn: row.ref_column },
    ])
  }
  return byTable
}

/**
 * Whether the row `table.column = id` exists and is owned by `userId`. A table
 * without a `user_id` column fails the query, which is read as "not yours" by
 * the caller rather than as a pass.
 */
export async function isRowOwnedBy(
  table: string,
  column: string,
  id: string,
  userId: string,
): Promise<boolean> {
  const rows = (await db.execute(
    sql`SELECT 1 FROM ${sql.identifier(table)}
        WHERE ${sql.identifier(column)} = ${id} AND user_id = ${userId}
        LIMIT 1`,
  )) as unknown as unknown[]
  return rows.length > 0
}
