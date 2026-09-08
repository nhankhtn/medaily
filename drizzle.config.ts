import { defineConfig } from 'drizzle-kit'
import { existsSync } from 'node:fs'
import dotenv from 'dotenv'

for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) dotenv.config({ path: file, override: false, quiet: true })
}

export default defineConfig({
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  verbose: true,
  strict: true,
})
