import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { stampOf } from '../../scripts/docs-stamp'

/**
 * The `/docs` site is built on somebody's machine and committed, so that a
 * deploy does not have to install a second dependency tree and run a second
 * bundler to publish a page nobody changed.
 *
 * What that trades away is the guarantee that the published page matches the
 * document. Editing `docs/features/daily-log.md` and pushing it now changes the source
 * and leaves the site as it was — and a page that is quietly a week old reads
 * exactly like a page that is right.
 *
 * Hence this. `bun run docs:build` stamps what it built from; this compares
 * the stamp to what is on disk now.
 */
const STAMP = 'public/docs/.sources.json'

describe('the published docs site', () => {
  it('was built from the documents as they stand', () => {
    let stamped: Record<string, string>
    try {
      stamped = JSON.parse(readFileSync(STAMP, 'utf8')) as Record<string, string>
    } catch {
      throw new Error(
        `${STAMP} is missing. The committed /docs site is built by hand — run \`bun run docs:build\`.`,
      )
    }

    expect(stamped, 'run `bun run docs:build` and commit public/docs').toEqual(stampOf())
  })
})
