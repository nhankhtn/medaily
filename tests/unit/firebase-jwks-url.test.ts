import { describe, expect, it } from 'vitest'
import { JWKS_URL } from '@/lib/auth/firebase-verify'

/**
 * The rest of the verification suite mocks `createRemoteJWKSet`, which is what
 * lets it run offline — and is exactly why it stayed green while this URL was
 * wrong by one letter (`jwks` instead of `jwk`, a 404). `jose` fetches lazily,
 * so a bad URL surfaces only at the first real sign-in, as an `invalid_token`
 * indistinguishable from a bad credential.
 *
 * This test hits Google for real, so it is opt-in: `TEST_NETWORK=1 pnpm test`.
 * Skipped, it still documents why the plural spelling must not come back.
 */
const online = process.env.TEST_NETWORK === '1'
const describeNet = online ? describe : describe.skip

describeNet('Firebase JWKS endpoint', () => {
  it('serves a usable key set at the configured URL', async () => {
    const response = await fetch(JWKS_URL, { signal: AbortSignal.timeout(15_000) })
    expect(response.status).toBe(200)

    const body = (await response.json()) as { keys?: { kid?: string; kty?: string }[] }
    expect(Array.isArray(body.keys)).toBe(true)
    expect(body.keys?.length ?? 0).toBeGreaterThan(0)
    expect(body.keys?.every((key) => key.kty === 'RSA' && Boolean(key.kid))).toBe(true)
  })

  it('confirms the plural spelling is not a valid endpoint', async () => {
    const wrong = JWKS_URL.href.replace('/v1/jwk/', '/v1/jwks/')
    const response = await fetch(wrong, { signal: AbortSignal.timeout(15_000) })
    expect(response.status).toBe(404)
  })
})
