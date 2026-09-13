import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import journal from '../../drizzle/meta/_journal.json'

/**
 * /api/health reports how many migrations this build expects by counting the
 * journal. That number is only useful if the journal matches what is actually
 * in the folder — a generated migration left uncommitted, or a renamed file
 * with a stale tag, would make a broken deploy look healthy.
 */
const FOLDER = join(process.cwd(), 'drizzle')
const files = readdirSync(FOLDER)
  .filter((name) => name.endsWith('.sql') && name !== 'views.sql')
  .sort()

describe('the migration journal', () => {
  it('has an entry for every file', () => {
    const tags = new Set(journal.entries.map((entry) => entry.tag))
    const orphans = files.filter((name) => !tags.has(name.replace(/\.sql$/, '')))
    expect(orphans).toEqual([])
  })

  it('has a file for every entry', () => {
    const onDisk = new Set(files.map((name) => name.replace(/\.sql$/, '')))
    const missing = journal.entries.filter((entry) => !onDisk.has(entry.tag))
    expect(missing.map((entry) => entry.tag)).toEqual([])
  })

  it('is numbered without gaps, so the count means what it says', () => {
    expect(journal.entries.map((entry) => entry.idx)).toEqual(
      journal.entries.map((_, index) => index),
    )
  })

  it('agrees with the file name prefixes', () => {
    for (const entry of journal.entries) {
      expect(entry.tag.startsWith(String(entry.idx).padStart(4, '0'))).toBe(true)
    }
  })
})
