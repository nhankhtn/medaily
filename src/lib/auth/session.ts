/**
 * Minimal signed-cookie session. Runs in both the Node and Edge runtimes, so it
 * uses Web Crypto only — the middleware cannot import node:crypto.
 *
 * Credentials live in the environment (spec 29): this is a single-user gate in
 * front of personal data, not a user directory.
 */
const COOKIE_NAME = 'medaily_session'
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30

export const SESSION_COOKIE = COOKIE_NAME

export type SessionPayload = {
  /** Subject: the configured username. */
  sub: string
  /** Issued-at and expiry, both seconds since epoch. */
  iat: number
  exp: number
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
  payload: Omit<SessionPayload, 'iat' | 'exp'>,
  secret: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const body: SessionPayload = { ...payload, iat: now, exp: now + ttlSeconds }
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
