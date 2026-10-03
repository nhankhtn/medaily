/** A handle someone can type. Stored lowercase, so the unique index is the rule. */
const USERNAME = /^[a-z][a-z0-9_]{2,19}$/

/** Null when it cannot be a username. An address is looked up separately. */
export function parseUsername(value: string): string | null {
  const handle = value.trim().toLowerCase()
  return USERNAME.test(handle) ? handle : null
}

/**
 * The part of an address before `@`, kept only where it is already a handle.
 * Dots and plus-tags drop out, so `ada.lane@x.com` becomes `adalane`.
 */
export function usernameFromEmail(email: string): string | null {
  const local = email.split('@')[0] ?? ''
  return parseUsername(local.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))
}

/** The address's handle, then the same handle with a short suffix when that one is taken. */
export function usernameCandidates(base: string): string[] {
  const out = [base]
  for (let n = 2; n <= 20; n++) {
    const suffix = String(n)
    const candidate = parseUsername(`${base.slice(0, 20 - suffix.length)}${suffix}`)
    if (candidate && !out.includes(candidate)) out.push(candidate)
  }
  return out
}
