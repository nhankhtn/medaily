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

export const LOGIN_PATH = '/login'

/** Paths that must stay reachable without a session. */
export const PUBLIC_PATHS = [LOGIN_PATH, '/api/health', '/manifest.webmanifest']
