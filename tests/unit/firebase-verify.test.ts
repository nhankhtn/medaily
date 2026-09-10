import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose'

/**
 * Verifying a Firebase ID token is the one moment this app trusts something
 * that came from outside, so every rejection path is exercised with a real
 * RS256 signature rather than a stub.
 *
 * Google's key endpoint is swapped for a locally generated key pair: the test
 * signs its own tokens, and no network is involved.
 */
const holder = vi.hoisted(() => ({
  resolve: null as unknown as (...args: unknown[]) => unknown,
}))

vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jose')>()
  return {
    ...actual,
    createRemoteJWKSet: () => (...args: unknown[]) => holder.resolve(...args),
  }
})

const { FirebaseVerifyError, verifyFirebaseIdToken } = await import('@/lib/auth/firebase-verify')

const PROJECT = 'medaily-demo'
const ISSUER = `https://securetoken.google.com/${PROJECT}`

let privateKey: CryptoKey
let publicJwk: JWK

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true })
  privateKey = pair.privateKey
  publicJwk = { ...(await exportJWK(pair.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' }

  const local = createLocalJWKSet({ keys: [publicJwk] })
  holder.resolve = (...args: unknown[]) =>
    (local as unknown as (...a: unknown[]) => unknown)(...args)
})

type Claims = Record<string, unknown>

async function token(claims: Claims = {}, options: { issuer?: string; audience?: string } = {}) {
  return new SignJWT({
    email: 'owner@example.com',
    email_verified: true,
    name: 'Owner',
    picture: 'https://example.com/a.png',
    firebase: { sign_in_provider: 'google.com' },
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? PROJECT)
    .setSubject((claims.sub as string) ?? 'firebase-uid-1')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey)
}

async function reasonOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
    return 'no error thrown'
  } catch (error) {
    return error instanceof FirebaseVerifyError ? error.reason : `unexpected: ${String(error)}`
  }
}

describe('verifyFirebaseIdToken', () => {
  it('accepts a well-formed token and returns the identity', async () => {
    const identity = await verifyFirebaseIdToken(await token(), PROJECT)

    expect(identity.uid).toBe('firebase-uid-1')
    expect(identity.email).toBe('owner@example.com')
    expect(identity.displayName).toBe('Owner')
    expect(identity.signInProvider).toBe('google.com')
  })

  it('lowercases the email, because accounts are matched by it', async () => {
    const identity = await verifyFirebaseIdToken(
      await token({ email: 'Owner@Example.COM' }),
      PROJECT,
    )
    expect(identity.email).toBe('owner@example.com')
  })

  /** A token minted for someone else's Firebase project must not be replayable here. */
  it('rejects a token issued for another project', async () => {
    const other = await token({}, { issuer: 'https://securetoken.google.com/other', audience: 'other' })
    expect(await reasonOf(verifyFirebaseIdToken(other, PROJECT))).toBe('wrong_audience')
  })

  it('rejects a token whose audience was swapped but issuer kept', async () => {
    const mixed = await token({}, { audience: 'other' })
    expect(await reasonOf(verifyFirebaseIdToken(mixed, PROJECT))).toBe('wrong_audience')
  })

  /**
   * An unverified address can be attacker-controlled, and email is what links
   * a Google account to an existing workspace.
   */
  it('rejects an unverified email', async () => {
    const unverified = await token({ email_verified: false })
    expect(await reasonOf(verifyFirebaseIdToken(unverified, PROJECT))).toBe('email_unverified')
  })

  it('rejects a token with no email at all', async () => {
    const anonymous = await token({ email: undefined })
    expect(await reasonOf(verifyFirebaseIdToken(anonymous, PROJECT))).toBe('email_missing')
  })

  it('rejects a token signed by a key it does not know', async () => {
    const stranger = await generateKeyPair('RS256', { extractable: true })
    const forged = await new SignJWT({ email: 'x@example.com', email_verified: true })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(ISSUER)
      .setAudience(PROJECT)
      .setSubject('firebase-uid-2')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(stranger.privateKey)

    expect(await reasonOf(verifyFirebaseIdToken(forged, PROJECT))).toBe('invalid_token')
  })

  it('rejects an expired token', async () => {
    const stale = await new SignJWT({ email: 'x@example.com', email_verified: true })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(ISSUER)
      .setAudience(PROJECT)
      .setSubject('firebase-uid-3')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(privateKey)

    // Expiry surfaces as `ERR_JWT_EXPIRED`, not a claim mismatch.
    expect(await reasonOf(verifyFirebaseIdToken(stale, PROJECT))).toBe('invalid_token')
  })

  it('refuses to verify anything when no project is configured', async () => {
    expect(await reasonOf(verifyFirebaseIdToken(await token(), ''))).toBe('not_configured')
  })

  it('rejects junk without throwing something unexpected', async () => {
    expect(await reasonOf(verifyFirebaseIdToken('not-a-jwt', PROJECT))).toBe('invalid_token')
    expect(await reasonOf(verifyFirebaseIdToken('', PROJECT))).toBe('invalid_token')
    expect(await reasonOf(verifyFirebaseIdToken('a.'.repeat(9000), PROJECT))).toBe('invalid_token')
  })
})
