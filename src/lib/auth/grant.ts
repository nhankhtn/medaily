import { hkdfSync } from 'node:crypto'
import { EncryptJWT, jwtDecrypt } from 'jose'
import { env } from '@/lib/env'

/**
 * A capability token: one person, one thing they may do, and the whole of the
 * configuration sealed inside it.
 *
 * It carries ids rather than names because `scripts/grant-token.ts` resolves
 * them against the database when it mints one — a typo fails there, in front
 * of whoever is minting, instead of at the moment somebody tries to use it.
 *
 * Encrypted rather than signed. The claims are internal plumbing — a user id,
 * an account id — that the holder has no reason to carry around, and a signed
 * token hands them over to anyone who pastes it into a decoder.
 */

/**
 * The key is derived from `AUTH_SECRET`, which is why issuing a grant needs no
 * second secret in the environment.
 *
 * With its own label, so this key and the session key are different keys. Used
 * directly, one leak would be both. **Rotating `AUTH_SECRET` invalidates every
 * grant token** — correct, and documented in docs/operations, because it is
 * otherwise a mystery outage.
 */
const INFO = 'medaily:grant-token:v1'

export type GrantClaims = {
  /** Whose ledger this writes into. */
  ownerUserId: string
  /** The contact the money is handed to — `payeePersonId` on the row. */
  payeePersonId: string
  /** The account it leaves. Not the caller's to choose. */
  accountId: string
  /** Used when the caller names no category. */
  categoryId: string | null
  /** Largest single amount, in the ledger's currency. */
  maxAmount: number
}

export function grantKey(secret: string): Uint8Array {
  // 32 bytes for A256GCM. The salt is empty on purpose: `AUTH_SECRET` is
  // already high-entropy, and a salt would be one more thing to carry.
  return new Uint8Array(hkdfSync('sha256', secret, new Uint8Array(0), INFO, 32))
}

export async function issueGrantToken(
  claims: GrantClaims,
  secret: string,
  expiresIn: string,
): Promise<string> {
  return new EncryptJWT({
    pid: claims.payeePersonId,
    acc: claims.accountId,
    cat: claims.categoryId,
    max: claims.maxAmount,
  })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setSubject(claims.ownerUserId)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    // Unused today. It is the only thing that would let a revocation list be
    // added later without changing the token format.
    .setJti(crypto.randomUUID())
    .encrypt(grantKey(secret))
}

/** `null` for anything that is not a live token: expired, altered, or wrong key. */
export async function readGrantToken(
  token: string,
  secret: string,
): Promise<GrantClaims | null> {
  try {
    const { payload } = await jwtDecrypt(token, grantKey(secret))
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.pid !== 'string' ||
      typeof payload.acc !== 'string' ||
      typeof payload.max !== 'number'
    ) {
      return null
    }

    return {
      ownerUserId: payload.sub,
      payeePersonId: payload.pid,
      accountId: payload.acc,
      categoryId: typeof payload.cat === 'string' ? payload.cat : null,
      maxAmount: payload.max,
    }
  } catch {
    return null
  }
}

/**
 * The grant this deploy will honour, or `null` where none is configured.
 *
 * The presented token is compared against the configured one before it is
 * decrypted, so a stranger's token cannot be spent even if it were minted with
 * this key. That makes `GRANT_TOKEN` the revocation: change it and redeploy.
 */
export async function readConfiguredGrant(presented: string): Promise<GrantClaims | null> {
  const configured = env.GRANT_TOKEN?.trim()
  const secret = env.AUTH_SECRET
  if (!configured || !secret || secret.length < 16) return null
  if (!sameToken(presented, configured)) return null

  return readGrantToken(configured, secret)
}

/**
 * Constant time, so the comparison does not leak the token a character at a
 * time through how long it takes to fail.
 */
export function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
