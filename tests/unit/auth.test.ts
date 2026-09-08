import { describe, expect, it } from 'vitest'
import { safeEqual, signSession, verifySession } from '@/lib/auth/session'

/**
 * The session gate is the only thing standing between a public URL and every
 * personal record in the database, so its failure modes are tested explicitly.
 */
const SECRET = 'test-secret-that-is-long-enough-32'

describe('session tokens', () => {
  it('round-trips a payload', async () => {
    const token = await signSession({ sub: 'me' }, SECRET)
    const payload = await verifySession(token, SECRET)
    expect(payload?.sub).toBe('me')
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await signSession({ sub: 'me' }, SECRET)
    expect(await verifySession(token, 'another-secret-long-enough-3232')).toBeNull()
  })

  it('rejects a tampered payload', async () => {
    const token = await signSession({ sub: 'me' }, SECRET)
    const [encoded, signature] = token.split('.')
    const forged = `${encoded?.slice(0, -2)}AA.${signature}`
    expect(await verifySession(forged, SECRET)).toBeNull()
  })

  it('rejects a tampered signature', async () => {
    const token = await signSession({ sub: 'me' }, SECRET)
    expect(await verifySession(`${token.slice(0, -4)}aaaa`, SECRET)).toBeNull()
  })

  it('rejects an expired token', async () => {
    const token = await signSession({ sub: 'me' }, SECRET, -10)
    expect(await verifySession(token, SECRET)).toBeNull()
  })

  it('rejects malformed input rather than throwing', async () => {
    expect(await verifySession(undefined, SECRET)).toBeNull()
    expect(await verifySession('', SECRET)).toBeNull()
    expect(await verifySession('no-dot', SECRET)).toBeNull()
    expect(await verifySession('a.b', SECRET)).toBeNull()
  })
})

describe('safeEqual', () => {
  it('matches identical strings', () => {
    expect(safeEqual('password', 'password')).toBe(true)
  })

  it('rejects different strings, including different lengths', () => {
    expect(safeEqual('password', 'Password')).toBe(false)
    expect(safeEqual('password', 'pass')).toBe(false)
    expect(safeEqual('', 'x')).toBe(false)
  })

  it('handles unicode', () => {
    expect(safeEqual('mật khẩu', 'mật khẩu')).toBe(true)
    expect(safeEqual('mật khẩu', 'mat khau')).toBe(false)
  })
})
