import { existsSync } from 'node:fs'
import dotenv from 'dotenv'

/** Mirrors Next.js precedence: .env.local overrides .env. */
for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) dotenv.config({ path: file, override: false, quiet: true })
}
