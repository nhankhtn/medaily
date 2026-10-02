import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Records which documents the committed `/docs` site was built from.
 *
 * The build output is committed rather than rebuilt on every deploy, which
 * takes a second dependency tree and a second bundler off every push. The
 * price is that editing a document no longer publishes it — somebody has to
 * remember to run the build — and a stale page is the one failure that looks
 * exactly like a working one.
 *
 * So the sources are stamped here and `tests/unit/docs-built.test.ts` checks
 * the stamp. Forgetting the rebuild turns a silent drift into a red test,
 * which is the same bargain `.env.example` already makes with its own test.
 */
const SOURCE_DIR = 'docs'
const STAMP = 'public/docs/.sources.json'

// `_category_.json` sets sidebar labels, so it is a source too. `site/` is the renderer.
const isSource = (name: string) => name.endsWith('.md') || name === '_category_.json'
const SKIPPED_DIRS = new Set(['site', 'node_modules'])

export function stampOf(dir = SOURCE_DIR): Record<string, string> {
  const stamp: Record<string, string> = {}

  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) walk(path)
      } else if (isSource(entry.name)) {
        const body = readFileSync(path)
        stamp[relative(dir, path)] = createHash('sha256').update(body).digest('hex').slice(0, 16)
      }
    }
  }
  walk(dir)

  return Object.fromEntries(Object.entries(stamp).sort(([a], [b]) => a.localeCompare(b)))
}

// Only when run directly: the test imports `stampOf` and must not write.
if (process.argv[1]?.endsWith('docs-stamp.ts')) {
  writeFileSync(STAMP, `${JSON.stringify(stampOf(), null, 2)}\n`)
  console.log(`stamped ${Object.keys(stampOf()).length} documents into ${STAMP}`)
}
