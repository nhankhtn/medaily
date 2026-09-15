import './load-env'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { databaseFingerprint } from '../src/lib/db/fingerprint'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

/**
 * Migrations are explicit — never run automatically on boot (spec 34).
 * After the generated migrations, idempotent view/trigger SQL is re-applied.
 *
 * Usage: pnpm db:migrate [databaseUrl]
 * The URL also comes from DATABASE_URL, which is how a deploy's database is
 * reached: DATABASE_URL="postgres://…" pnpm db:migrate
 */
async function main() {
  const url = process.argv[2] ?? process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')

  // Say which database, so migrating the wrong one is a visible mistake.
  console.log(`→ ${describe(url)}  (fingerprint ${databaseFingerprint(url) ?? 'unknown'})`)
  console.log('  compare it with databaseFingerprint on the deploy\'s /api/health')

  const client = postgres(url, { max: 1 })
  const db = drizzle(client)

  const before = await appliedCount(client)

  console.log('→ applying migrations')
  await migrate(db, { migrationsFolder: './drizzle' })

  console.log('→ applying views and triggers')
  const viewsSql = readFileSync(resolve('drizzle/views.sql'), 'utf8')
  await client.unsafe(viewsSql)

  const after = await appliedCount(client)
  console.log(
    after > before
      ? `✓ applied ${after - before} migration(s); database is up to date`
      : '✓ nothing to apply; database was already up to date',
  )
  await client.end()
}

/** Host and database only — never the credentials. */
function describe(url: string): string {
  try {
    const { host, pathname } = new URL(url)
    return `${host}${pathname}`
  } catch {
    return 'the configured database'
  }
}

async function appliedCount(client: postgres.Sql): Promise<number> {
  const rows = await client<{ count: string }[]>`
    SELECT count(*)::text AS count
    FROM information_schema.tables
    WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
  `
  if (rows[0]?.count === '0') return 0

  const applied = await client<{ count: string }[]>`
    SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations
  `
  return Number(applied[0]?.count ?? 0)
}

main().catch((error) => {
  console.error('✗ migration failed:', error)
  process.exit(1)
})
