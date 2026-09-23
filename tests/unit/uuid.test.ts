import { afterEach, describe, expect, it, vi } from 'vitest'
import { randomUuid } from '@/lib/uuid'

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('randomUuid', () => {
  it('is a v4 uuid', () => {
    expect(randomUuid()).toMatch(V4)
  })

  it('still is one where randomUUID is missing, as on a phone over plain http', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    expect(randomUuid()).toMatch(V4)
  })

  it('does not repeat itself', () => {
    const seen = new Set(Array.from({ length: 500 }, randomUuid))
    expect(seen.size).toBe(500)
  })
})
