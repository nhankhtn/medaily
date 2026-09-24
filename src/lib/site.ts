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
  // A typo is skipped rather than thrown. This is read while the root layout
  // builds its metadata, so a `new URL()` that throws is not a bad canonical —
  // it is every page in the app failing to render.
  const configured = parse(env.SITE_URL)
  if (configured) return configured

  // Injected by the platform rather than configured by hand, so it is read
  // straight from the environment instead of going through the schema.
  const vercel = parse(process.env.VERCEL_PROJECT_PRODUCTION_URL)
  if (vercel) return vercel

  return new URL('http://localhost:3000')
}

function parse(value: string | undefined): URL | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  try {
    return new URL(withScheme(trimmed))
  } catch {
    return null
  }
}

/** Vercel hands over a bare hostname; a person pasting one usually does too. */
function withScheme(value: string): string {
  return /^https?:\/\//.test(value) ? value : `https://${value}`
}
