import { existsSync } from 'node:fs'
import dotenv from 'dotenv'

for (const file of ['.env.test.local', '.env.local', '.env']) {
  if (existsSync(file)) dotenv.config({ path: file, override: false, quiet: true })
}
