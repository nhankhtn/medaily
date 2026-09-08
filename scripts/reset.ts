import './load-env'
import { execSync } from 'node:child_process'
import postgres from 'postgres'

/** Drops the public schema, re-migrates and re-seeds (spec 32). */
async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  if (process.env.NODE_ENV === 'production') {
    throw new Error('db:reset refuses to run with NODE_ENV=production')
  }

  const client = postgres(url, { max: 1 })
  console.log('→ dropping schema')
  await client.unsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  await client.end()

  execSync('pnpm db:migrate', { stdio: 'inherit' })
  execSync('pnpm db:seed', { stdio: 'inherit' })
}

main().catch((error) => {
  console.error('✗ reset failed:', error)
  process.exit(1)
})
