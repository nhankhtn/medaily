import type { AuthConfig } from './config'
import { safeEqual } from './session'

export const BASIC_REALM = 'medaily docs'

/** Whether an `Authorization: Basic …` header names the configured account. Closed when unconfigured. */
export function basicCredentialsMatch(header: string | null, auth: AuthConfig): boolean {
  if (!auth.configured || !header?.startsWith('Basic ')) return false

  let decoded: string
  try {
    const bytes = Uint8Array.from(atob(header.slice('Basic '.length).trim()), (c) =>
      c.charCodeAt(0),
    )
    decoded = new TextDecoder().decode(bytes)
  } catch {
    return false
  }

  // The first colon splits: a password may hold one, a username may not.
  const colon = decoded.indexOf(':')
  if (colon < 0) return false

  // Both always run, so a wrong username costs the same as a wrong password.
  const okUser = safeEqual(decoded.slice(0, colon), auth.username)
  const okPassword = safeEqual(decoded.slice(colon + 1), auth.password)
  return okUser && okPassword
}
