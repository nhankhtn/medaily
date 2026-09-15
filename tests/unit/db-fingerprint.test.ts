import { describe, expect, it } from 'vitest'
import { databaseFingerprint } from '@/lib/db/fingerprint'

const NEON = 'postgres://me:secret@ep-wild-mouse-ayqzjnv8.c-5.aws.neon.tech/medaily?sslmode=require'
const POOLED = 'postgres://me:secret@ep-wild-mouse-ayqzjnv8-pooler.c-5.aws.neon.tech/medaily'

describe('databaseFingerprint', () => {
  it('is the same for the same database whatever the credentials', () => {
    const other = NEON.replace('me:secret', 'someone:else')
    expect(databaseFingerprint(NEON)).toBe(databaseFingerprint(other))
  })

  it('treats the pooled and direct endpoints as one database, because they are', () => {
    expect(databaseFingerprint(POOLED)).toBe(databaseFingerprint(NEON))
  })

  it('differs when the database differs', () => {
    expect(databaseFingerprint(NEON)).not.toBe(databaseFingerprint(NEON.replace('/medaily', '/staging')))
  })

  it('differs when the host differs', () => {
    expect(databaseFingerprint(NEON)).not.toBe(
      databaseFingerprint(NEON.replace('ep-wild-mouse-ayqzjnv8', 'ep-other-goose-1234567')),
    )
  })

  it('gives nothing away: no host, no database name, no password', () => {
    const print = databaseFingerprint(NEON) ?? ''
    expect(print).toMatch(/^[0-9a-f]{8}$/)
    for (const secret of ['secret', 'medaily', 'neon.tech', 'ep-wild-mouse']) {
      expect(print).not.toContain(secret)
    }
  })

  it('says nothing rather than throwing when there is no url', () => {
    expect(databaseFingerprint(undefined)).toBeNull()
    expect(databaseFingerprint('not a url')).toBeNull()
  })
})
