import { describe, expect, it } from 'vitest'
import { grantKey, issueGrantToken, readGrantToken, sameToken } from '@/lib/auth/grant'

/**
 * The token is the whole of the authorization: who may write, into whose
 * ledger, and how much. Nothing else checks any of it, so what matters is that
 * a token which is not exactly the one that was minted opens nothing.
 */
const SECRET = 'a-secret-long-enough-to-be-real'
const claims = {
  ownerUserId: '11111111-1111-4111-8111-111111111111',
  payeePersonId: '22222222-2222-4222-8222-222222222222',
  accountId: '33333333-3333-4333-8333-333333333333',
  categoryId: '44444444-4444-4444-8444-444444444444',
  maxAmount: 200_000,
}

describe('a grant token', () => {
  it('comes back as it went in', async () => {
    const token = await issueGrantToken(claims, SECRET, '1d')
    expect(await readGrantToken(token, SECRET)).toEqual(claims)
  })

  /** The claims are a user id and an account id — plumbing the holder has no use for. */
  it('does not carry its claims in the clear', async () => {
    const token = await issueGrantToken(claims, SECRET, '1d')
    expect(token).not.toContain(claims.ownerUserId)
    expect(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()).not.toContain(
      claims.accountId,
    )
  })

  it('opens with nothing but the secret it was minted under', async () => {
    const token = await issueGrantToken(claims, SECRET, '1d')
    expect(await readGrantToken(token, 'a-different-secret-entirely')).toBeNull()
  })

  /** Rotating `AUTH_SECRET` therefore revokes every grant, which is the intent. */
  it('dies with the secret it was derived from', () => {
    expect(grantKey(SECRET)).not.toEqual(grantKey(`${SECRET}!`))
    expect(grantKey(SECRET)).toEqual(grantKey(SECRET))
  })

  it('refuses one that has expired', async () => {
    const token = await issueGrantToken(claims, SECRET, '0s')
    await new Promise((resolve) => setTimeout(resolve, 1100))
    expect(await readGrantToken(token, SECRET)).toBeNull()
  })

  it('refuses one that has been altered', async () => {
    const token = await issueGrantToken(claims, SECRET, '1d')
    const bent = `${token.slice(0, -2)}${token.endsWith('A') ? 'B' : 'A'}=`
    expect(await readGrantToken(bent, SECRET)).toBeNull()
  })

  it('refuses something that is not a token at all', async () => {
    expect(await readGrantToken('', SECRET)).toBeNull()
    expect(await readGrantToken('not.a.token', SECRET)).toBeNull()
  })

  it('carries no category when none was set', async () => {
    const token = await issueGrantToken({ ...claims, categoryId: null }, SECRET, '1d')
    expect((await readGrantToken(token, SECRET))?.categoryId).toBeNull()
  })
})

describe('sameToken', () => {
  it('accepts only an exact match', () => {
    expect(sameToken('abc', 'abc')).toBe(true)
    expect(sameToken('abc', 'abd')).toBe(false)
    expect(sameToken('abc', 'abcd')).toBe(false)
    expect(sameToken('', '')).toBe(true)
  })
})
