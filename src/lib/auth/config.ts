/**
 * Credentials come from the environment and nowhere else. Missing values mean
 * the gate is *closed*, never open — a misconfigured deploy must not silently
 * publish personal data.
 */
export type AuthConfig = {
  username: string
  password: string
  secret: string
  configured: boolean
}

export function readAuthConfig(): AuthConfig {
  const username = process.env.AUTH_USERNAME ?? ''
  const password = process.env.AUTH_PASSWORD ?? ''
  const secret = process.env.AUTH_SECRET ?? ''

  return {
    username,
    password,
    secret,
    configured: username.length > 0 && password.length > 0 && secret.length >= 16,
  }
}

/**
 * Google sign-in through Firebase. Only the project id is needed: ID tokens are
 * verified against Google's public keys, so there is no service account file
 * and no second secret to leak. `AUTH_SECRET` still signs our own cookie.
 */
export type GoogleAuthConfig = {
  projectId: string
  configured: boolean
}

export function readGoogleConfig(): GoogleAuthConfig {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? ''
  return { projectId, configured: projectId.length > 0 }
}

/**
 * Who is allowed in.
 *
 * The default is deliberately **closed**: an empty allowlist with signup off
 * means only the owner can sign in. This app holds a journal, health records
 * and finances — leaving registration open to anyone with a Google account
 * because the URL happens to be public is not a default worth shipping.
 *
 * - `AUTH_OWNER_EMAIL` — this address links to the pre-existing owner row
 *   instead of getting a new, empty workspace.
 * - `AUTH_ALLOWED_EMAILS` / `AUTH_ALLOWED_DOMAINS` — comma separated.
 * - `AUTH_ALLOW_SIGNUP=true` — anyone who passes the lists above gets a
 *   workspace. Without it, only addresses already known to the database.
 */
export type AccessPolicy = {
  ownerEmail: string | null
  allowedEmails: string[]
  allowedDomains: string[]
  allowSignup: boolean
}

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0)
}

export function readAccessPolicy(): AccessPolicy {
  const ownerEmail = (process.env.AUTH_OWNER_EMAIL ?? '').trim().toLowerCase()
  return {
    ownerEmail: ownerEmail.length > 0 ? ownerEmail : null,
    allowedEmails: list(process.env.AUTH_ALLOWED_EMAILS),
    allowedDomains: list(process.env.AUTH_ALLOWED_DOMAINS),
    allowSignup: process.env.AUTH_ALLOW_SIGNUP === 'true',
  }
}

/**
 * Whether an address is permitted to reach the *identity* stage at all. Being
 * permitted is not the same as being provisioned: an unknown address still
 * needs `allowSignup` before a workspace is created for it.
 */
export function emailIsPermitted(email: string, policy: AccessPolicy): boolean {
  const normalized = email.trim().toLowerCase()
  if (normalized.length === 0) return false
  if (normalized === policy.ownerEmail) return true
  if (policy.allowedEmails.includes(normalized)) return true

  const domain = normalized.slice(normalized.lastIndexOf('@') + 1)
  if (domain.length > 0 && policy.allowedDomains.includes(domain)) return true

  // No lists configured at all: fall back to whether signup is open, so a
  // deploy that sets nothing stays owner-only.
  return (
    policy.allowedEmails.length === 0 && policy.allowedDomains.length === 0 && policy.allowSignup
  )
}

export const LOGIN_PATH = '/login'

/** Paths that must stay reachable without a session. */
export const PUBLIC_PATHS = [
  LOGIN_PATH,
  '/api/health',
  '/api/auth/google',
  '/manifest.webmanifest',
]
