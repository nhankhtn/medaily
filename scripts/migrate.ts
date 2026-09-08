import './load-env'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

/**
 * Migrations are explicit — never run automatically on boot (spec 34).
 * After the generated migrations, idempotent view/trigger SQL is re-applied.
 */
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')

  const client = postgres(url, { max: 1 })
  const db = drizzle(client)

  console.log('→ applying migrations')
  await migrate(db, { migrationsFolder: './drizzle' })

  console.log('→ applying views and triggers')
  const viewsSql = readFileSync(resolve('drizzle/views.sql'), 'utf8')
  await client.unsafe(viewsSql)

  console.log('✓ database is up to date')
  await client.end()
}

main().catch((error) => {
  console.error('✗ migration failed:', error)
  process.exit(1)
})
