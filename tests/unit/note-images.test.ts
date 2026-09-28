import { describe, expect, it } from 'vitest'
import { isOrphan } from '@/server/services/note-images'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-09-26T12:00:00Z')

const asset = (publicId: string, ageMs: number) => ({
  publicId,
  createdAt: new Date(NOW - ageMs),
})

describe('isOrphan', () => {
  const referenced = new Set(['medaily/u/notes/u/kept'])

  it('keeps a picture some note still points at, however old', () => {
    expect(isOrphan(asset('medaily/u/notes/u/kept', 400 * DAY), referenced, NOW)).toBe(false)
  })

  it('keeps an unreferenced picture inside the grace window', () => {
    // The note it belongs to may simply not have been saved yet.
    expect(isOrphan(asset('medaily/u/notes/u/fresh', 2 * 60 * 1000), referenced, NOW)).toBe(false)
  })

  it('removes an unreferenced picture once the grace window has passed', () => {
    expect(isOrphan(asset('medaily/u/notes/u/gone', 2 * DAY), referenced, NOW)).toBe(true)
  })

  it('treats the boundary as past, not pending', () => {
    expect(isOrphan(asset('medaily/u/notes/u/edge', DAY), referenced, NOW)).toBe(true)
    expect(isOrphan(asset('medaily/u/notes/u/edge', DAY - 1), referenced, NOW)).toBe(false)
  })

  it('an empty reference set does not make everything rubbish immediately', () => {
    expect(isOrphan(asset('medaily/u/notes/u/x', 60 * 1000), new Set(), NOW)).toBe(false)
  })
})
