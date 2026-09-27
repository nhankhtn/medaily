/**
 * Minimal signed-cookie session. Runs in both the Node and Edge runtimes, so it
 * uses Web Crypto only — the middleware cannot import node:crypto.
 *
 * This cookie, not the Firebase ID token, is what every request is checked
 * against (spec 29). A Firebase token is verified exactly once, at sign-in,
 * and exchanged for one of these; afterwards no request touches Google.
 */
const COOKIE_NAME = 'medaily_session'
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30

/**
 * How long a session may be kept alive by using it, counted from the sign-in
 * that started it and never reset by a renewal.
 *
 * Without it, "renew while in use" means a stolen cookie that its thief keeps
 * warm never expires at all — the one property nobody would agree to if it
 * were written down. Six months is long enough that nobody notices it and
 * short enough that a lost phone stops being a key within one.
 */
const ABSOLUTE_MAX_SECONDS = 60 * 60 * 24 * 180

export const SESSION_COOKIE = COOKIE_NAME

/**
 * Payload version. v1 carried only `sub` (the configured username) because the
 * app was single-user; it cannot name a user row, so v1 cookies are rejected
 * and their holders sign in again once.
 */
export const SESSION_VERSION = 2

export type SessionProvider = 'password' | 'google'

export type SessionPayload = {
  v: number
  /** The `users.id` this session acts as. The only identity the app trusts. */
  uid: string
  /** Display subject: the username or the Google email. Never used for lookup. */
  sub: string
  provider: SessionProvider
  /** Issued-at and expiry, both seconds since epoch. */
  iat: number
  exp: number
  /**
   * When the sign-in behind this session happened, carried unchanged through
   * every renewal — which is what makes the ceiling a ceiling rather than
   * another thing that slides.
   *
   * Optional, and read through `sessionStartedAt`: cookies issued before
   * renewal existed have no `sat`, and rejecting them would sign everyone out
   * on the deploy that added this. Their `iat` is the sign-in they came from,
   * which is exactly what `sat` means.
   */
  sat?: number
}

/** The sign-in a session descends from, for a cookie of either vintage. */
export function sessionStartedAt(payload: SessionPayload): number {
  return payload.sat ?? payload.iat
}

/**
 * How long a renewed cookie should live, or null to leave it alone.
 *
 * Three refusals, in order. Before the halfway mark there is nothing to gain
 * and re-signing on every request is the thing to avoid. Past the ceiling the
 * session has had its six months. And once the ceiling is close enough that a
 * renewal would end no later than the cookie already does, renewing is churn —
 * this is what stops the last day turning into a re-sign on every page.
 *
 * The clamp is why the ceiling holds exactly: a new expiry is never later than
 * the sign-in plus the maximum, so no chain of renewals can walk past it.
 */
export function renewalTtl(payload: SessionPayload, nowSeconds: number): number | null {
  const life = payload.exp - payload.iat
  if (life <= 0) return null
  if (nowSeconds - payload.iat <= life / 2) return null

  const remaining = sessionStartedAt(payload) + ABSOLUTE_MAX_SECONDS - nowSeconds
  if (remaining <= 0) return null

  const ttl = Math.min(life, remaining)
  return nowSeconds + ttl > payload.exp ? ttl : null
}

function encoder() {
  return new TextEncoder()
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export async function signSession(
  payload: Omit<SessionPayload, 'iat' | 'exp' | 'v'>,
  secret: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const body: SessionPayload = {
    ...payload,
    v: SESSION_VERSION,
    iat: now,
    // A fresh sign-in starts the clock; a renewal hands back the one it had.
    sat: payload.sat ?? now,
    exp: now + ttlSeconds,
  }
  const encoded = base64UrlEncode(encoder().encode(JSON.stringify(body)))
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    encoder().encode(encoded),
  )
  return `${encoded}.${base64UrlEncode(new Uint8Array(signature))}`
}

/** Returns the payload only when the signature is valid and the token is unexpired. */
export async function verifySession(
  token: string | undefined,
  secret: string,
): Promise<SessionPayload | null> {
  if (!token) return null

  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return null

  let valid: boolean
  try {
    valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      base64UrlDecode(signature),
      encoder().encode(encoded),
    )
  } catch {
    return null
  }
  if (!valid) return null

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded))) as SessionPayload
    if (payload.v !== SESSION_VERSION) return null
    if (typeof payload.uid !== 'string' || payload.uid.length === 0) return null
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

/** Constant-time string comparison, so a wrong password leaks no timing signal. */
export function safeEqual(a: string, b: string): boolean {
  const left = encoder().encode(a)
  const right = encoder().encode(b)
  // Compare a fixed number of bytes regardless of length.
  const length = Math.max(left.length, right.length)
  let diff = left.length ^ right.length
  for (let i = 0; i < length; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0)
  }
  return diff === 0
}

/** Cookie attributes shared by every place that writes the session. */
export function sessionCookieOptions(maxAge = DEFAULT_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  } as const
}
