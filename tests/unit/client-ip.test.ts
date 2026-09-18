import { describe, expect, it } from 'vitest'
import { clientKey } from '@/lib/client-ip'

const withHeaders = (h: Record<string, string>) => new Headers(h)

describe('clientKey', () => {
  it('trusts x-real-ip, which the platform overwrites', () => {
    expect(clientKey(withHeaders({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7')
  })

  it('ignores a spoofed x-forwarded-for when the real ip is present', () => {
    const key = clientKey(
      withHeaders({ 'x-real-ip': '198.51.100.7', 'x-forwarded-for': '1.2.3.4, 198.51.100.7' }),
    )
    expect(key).toBe('198.51.100.7')
  })

  it('takes the last x-forwarded-for entry, the one the proxy appended', () => {
    // The client wrote the first; the platform added the real address last.
    expect(clientKey(withHeaders({ 'x-forwarded-for': '1.2.3.4, 198.51.100.7' }))).toBe(
      '198.51.100.7',
    )
  })

  it('cannot be moved by a value the client puts at the front', () => {
    const a = clientKey(withHeaders({ 'x-forwarded-for': '9.9.9.9, 203.0.113.5' }))
    const b = clientKey(withHeaders({ 'x-forwarded-for': '8.8.8.8, 203.0.113.5' }))
    // Same real caller, so the same bucket, whatever they prepend.
    expect(a).toBe(b)
    expect(a).toBe('203.0.113.5')
  })

  it('handles a single-entry x-forwarded-for', () => {
    expect(clientKey(withHeaders({ 'x-forwarded-for': '203.0.113.5' }))).toBe('203.0.113.5')
  })

  it('falls back to one shared key with no proxy in front', () => {
    expect(clientKey(withHeaders({}))).toBe('local')
  })

  it('does not treat a trailing comma as an address', () => {
    // A malformed list must not key everyone onto the empty string.
    expect(clientKey(withHeaders({ 'x-forwarded-for': '203.0.113.5, ' }))).toBe('local')
  })
})
