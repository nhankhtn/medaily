import './load-env'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import postgres from 'postgres'

/**
 * Marks the existing migrations as already applied, without running them.
 *
 * Needed when a database was created with `drizzle-kit push` (tables, but no
 * `drizzle.__drizzle_migrations` journal): a later `pnpm db:migrate` would try
 * to replay `0000_init.sql` and fail on "relation already exists". Hashes come
 * from Drizzle's own reader, so they match what the migrator expects.
 *
 * Refuses to run when a journal already exists — baselining a tracked database
 * would hide real pending migrations.
 */
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')

  const client = postgres(url, { max: 1 })

  const existing = await client`
    SELECT COUNT(*)::int AS count
    FROM information_schema.tables
    WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
  `
  const hasJournal = (existing[0]?.count ?? 0) > 0

  if (hasJournal) {
    const applied = await client`SELECT COUNT(*)::int AS count FROM drizzle."__drizzle_migrations"`
    console.log(`✓ already tracked: ${applied[0]?.count ?? 0} migrations recorded — nothing to do`)
    await client.end()
    return
  }

  const migrations = readMigrationFiles({ migrationsFolder: './drizzle' })
  if (migrations.length === 0) throw new Error('no migrations found in ./drizzle')

  console.log(`→ recording ${migrations.length} migrations as applied`)

  await client.unsafe(`
    CREATE SCHEMA IF NOT EXISTS "drizzle";
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    );
  `)

  for (const migration of migrations) {
    await client`
      INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
      VALUES (${migration.hash}, ${migration.folderMillis})
    `
    console.log(`  ✓ ${migration.hash.slice(0, 12)}…`)
  }

  console.log('✓ baseline complete — `pnpm db:migrate` will now apply only new migrations')
  await client.end()
}

main().catch((error) => {
  console.error('✗ baseline failed:', error)
  process.exit(1)
})
