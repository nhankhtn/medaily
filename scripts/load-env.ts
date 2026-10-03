import { existsSync } from 'node:fs'
import dotenv from 'dotenv'
import { databaseFingerprint } from '../src/lib/db/fingerprint'

/**
 * Local scripts. The app itself loads env through Next.js, not through here.
 *
 * `MEDAILY_ENV=prod` reads the production files and skips `.env.local`. The
 * production file overrides anything already in the shell, so a development
 * `DATABASE_URL` cannot sign a token meant for the live ledger.
 */
const mode = process.env.MEDAILY_ENV
const prod = mode === 'prod' || mode === 'production'
if (mode && !prod) throw new Error(`MEDAILY_ENV must be prod, got ${JSON.stringify(mode)}`)

const files = prod
  ? ['.env.production.local', '.env.production', '.env']
  : ['.env.local', '.env']

const present = files.filter((file) => existsSync(file))
if (prod && !present.some((file) => file.startsWith('.env.production'))) {
  throw new Error('MEDAILY_ENV=prod but there is no .env.production.local or .env.production')
}

for (const [index, file] of present.entries()) {
  dotenv.config({ path: file, override: prod && index === 0, quiet: true })
}

if (prod) {
  console.error(
    `→ production env (${present.join(', ')}), database ${databaseFingerprint(process.env.DATABASE_URL) ?? 'unknown'}`,
  )
}
