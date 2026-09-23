import { env } from '@/lib/env'

/**
 * Where this deployment lives, for the handful of places that need an absolute
 * URL: `metadataBase`, the Open Graph tags built from it, and `robots.txt`.
 *
 * `SITE_URL` wins when it is set, because a custom domain is the address a
 * person actually shares. Otherwise Vercel's own production hostname, which is
 * the *stable* one — `VERCEL_URL` changes with every deployment, so building a
 * canonical out of it would point at a preview that stops existing.
 *
 * Localhost last, so a preview card in development resolves to something that
 * loads rather than to a domain this build is not serving.
 */
export function siteUrl(): URL {
  const configured = env.SITE_URL?.trim()
  if (configured) return new URL(withScheme(configured))

  // Injected by the platform rather than configured by hand, so it is read
  // straight from the environment instead of going through the schema.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (vercel) return new URL(withScheme(vercel))

  return new URL('http://localhost:3000')
}

/** Vercel hands over a bare hostname; a person pasting one usually does too. */
function withScheme(value: string): string {
  return /^https?:\/\//.test(value) ? value : `https://${value}`
}
