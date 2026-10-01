import { beforeAll, describe, expect, it, vi } from 'vitest'
import { decodeJwt, decodeProtectedHeader, exportPKCS8, generateKeyPair, jwtVerify } from 'jose'

/**
 * The token a password sign-in gets its Firebase identity from.
 *
 * Every claim here is checked by Google rather than by us, and a wrong one
 * fails at `signInWithCustomToken` in somebody's browser with a message the
 * server never sees. So the shape is asserted against a real signature.
 */
const identities = vi.hoisted(() => ({ rows: [] as { providerUid: string }[] }))

vi.mock('@/server/repositories/auth', () => ({
  listIdentities: async () => identities.rows,
}))

const { realtimeUidFor, signCustomToken } = await import(
  '@/server/services/firebase-custom-token'
)

const AUDIENCE =
  'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit'

let config: { projectId: string; clientEmail: string; privateKey: string }
let publicKey: CryptoKey

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true })
  publicKey = pair.publicKey
  config = {
    projectId: 'medaily-demo',
    clientEmail: 'firebase-adminsdk-x@medaily-demo.iam.gserviceaccount.com',
    privateKey: await exportPKCS8(pair.privateKey),
  }
})

describe('signCustomToken', () => {
  it('carries the audience Google exchanges a custom token at', async () => {
    const token = await signCustomToken(config, 'user-1')
    // Spelled out rather than imported from the source: a typo copied into the
    // test would agree with a typo in the code and prove nothing.
    expect(decodeJwt(token).aud).toBe(AUDIENCE)
  })

  it('is signed RS256 by the service account, as itself', async () => {
    const token = await signCustomToken(config, 'user-1')

    expect(decodeProtectedHeader(token).alg).toBe('RS256')
    const { payload } = await jwtVerify(token, publicKey, { audience: AUDIENCE })
    // Firebase requires the signer to be both the issuer and the subject.
    expect(payload.iss).toBe(config.clientEmail)
    expect(payload.sub).toBe(config.clientEmail)
  })

  it('names the user in `uid`, which is the claim Firebase reads', async () => {
    const token = await signCustomToken(config, 'a9d3f0e2-0000-4000-8000-000000000001')
    expect(decodeJwt(token).uid).toBe('a9d3f0e2-0000-4000-8000-000000000001')
  })

  it('expires inside the hour Firebase allows', async () => {
    const { iat, exp } = decodeJwt(await signCustomToken(config, 'user-1'))

    expect(iat).toBeTypeOf('number')
    expect(exp).toBeTypeOf('number')
    // Not `<= 3600`: Firebase rejects at the boundary, and a token minted on a
    // clock a few seconds fast has to still be inside it.
    expect(exp! - iat!).toBeLessThan(3600)
    expect(exp! - iat!).toBeGreaterThan(60)
  })

  it('refuses a key that is not a private key, rather than signing nothing', async () => {
    await expect(signCustomToken({ ...config, privateKey: 'not-a-key' }, 'user-1')).rejects.toThrow()
  })
})

describe('realtimeUidFor', () => {
  it('reuses the Firebase uid Google sign-in already minted', async () => {
    identities.rows = [{ providerUid: 'kK3xQ9fbPaZr1TtUuVvWwXxYyZz0' }]
    // Otherwise the same person is two Firebase users, and the uid on a typing
    // document stops matching the one the reader was told to look for.
    await expect(realtimeUidFor('a9d3f0e2-0000-4000-8000-000000000001')).resolves.toBe(
      'kK3xQ9fbPaZr1TtUuVvWwXxYyZz0',
    )
  })

  it('falls back to the app id, which cannot collide with a Firebase uid', async () => {
    identities.rows = []
    await expect(realtimeUidFor('a9d3f0e2-0000-4000-8000-000000000001')).resolves.toBe(
      'a9d3f0e2-0000-4000-8000-000000000001',
    )
  })
})
