import { describe, expect, it } from 'vitest'
import { REQUEST_ID_HEADER, newRequestId, requestIdFrom } from '@/lib/request-id'

const headers = (values: Record<string, string>) => new Headers(values)

describe('requestIdFrom', () => {
  it('keeps an id the request already carries, so one trace stays one trace', () => {
    expect(requestIdFrom(headers({ [REQUEST_ID_HEADER]: 'abc123' }))).toBe('abc123')
  })

  it("falls back to the last part of Vercel's own id, which is what its logs are searched by", () => {
    expect(requestIdFrom(headers({ 'x-vercel-id': 'sin1::iad1::pdx7q-1757' }))).toBe('pdx7q-1757')
  })

  it('prefers ours over Vercel’s when both are present', () => {
    const both = headers({ [REQUEST_ID_HEADER]: 'ours', 'x-vercel-id': 'iad1::theirs' })
    expect(requestIdFrom(both)).toBe('ours')
  })

  it('makes one up when nothing is given', () => {
    const id = requestIdFrom(headers({}))
    expect(id).toMatch(/^[0-9a-f]{8}$/)
  })

  it('strips anything that would garble a log line', () => {
    const id = requestIdFrom(headers({ [REQUEST_ID_HEADER]: 'a b\tc d"e' }))
    expect(id).toBe('abcde')
  })

  it('does not return an empty id when the header is junk', () => {
    expect(requestIdFrom(headers({ [REQUEST_ID_HEADER]: '!!!' }))).toMatch(/^[0-9a-f]{8}$/)
  })

  it('caps a long upstream id rather than carrying it into every line', () => {
    const id = requestIdFrom(headers({ [REQUEST_ID_HEADER]: 'x'.repeat(200) }))
    expect(id).toHaveLength(64)
  })
})

describe('newRequestId', () => {
  it('is short and distinct', () => {
    const ids = new Set(Array.from({ length: 500 }, newRequestId))
    expect(ids.size).toBe(500)
    expect([...ids][0]).toHaveLength(8)
  })
})
