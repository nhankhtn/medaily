import { z } from 'zod'

/**
 * Environment is parsed once, at import, but a bad configuration does **not**
 * throw here.
 *
 * A module-scope throw kills the whole module graph: the root layout never
 * evaluates, React has no tree to render, and the browser gets an opaque
 * minified Server Components error with nothing actionable in it. Instead the
 * issues are collected, `/api/health` names them, the shell falls back to
 * defaults so the sign-in page still renders, and any route that actually
 * needs the database fails lomedailyudly.
 *
 * Command-line entry points want the opposite — call `assertEnv()` there to
 * refuse to run at all (spec 26.1).
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // The address people actually share, for `metadataBase` and the preview card
  // built from it. Absent, the deployment's own hostname is used instead.
  SITE_URL: z.string().optional(),

  // Printed in the privacy notice as where a deletion request goes. Validated
  // as an address rather than taken on trust: a typo here is published on a
  // public page as the only way to reach anyone.
  LEGAL_CONTACT_EMAIL: z.email('LEGAL_CONTACT_EMAIL must be an email address').optional(),

  // Whether anything is counted at all. Public, because the decision has to be
  // the same in the browser as on the server — a provider mounted on one side
  // and not the other is a hydration mismatch. Absent means nothing is sent,
  // which is what every environment but the deployed one should be.
  NEXT_PUBLIC_ANALYTICS_ENABLED: z.string().optional(),

  // Auth is a hard-coded credential pair plus, optionally, Google sign-in
  // (spec 29). Absent values keep the gate closed rather than open.
  AUTH_USERNAME: z.string().optional(),
  AUTH_PASSWORD: z.string().optional(),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 characters').optional(),

  // Google sign-in through Firebase. Only the project id is needed on the
  // server: ID tokens are verified against Google's public keys, so there is
  // no service account and no second secret.
  FIREBASE_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().optional(),

  // Who may sign in. Empty lists with signup off means owner-only.
  AUTH_OWNER_EMAIL: z.string().optional(),
  AUTH_ALLOWED_EMAILS: z.string().optional(),
  AUTH_ALLOWED_DOMAINS: z.string().optional(),
  AUTH_ALLOW_SIGNUP: z.string().optional(),

  // The agent service (`medaily-ai`), which answers with a memory that outlives
  // the tab. Absent, the capture box simply does not offer that destination.
  AI_SERVICE_URL: z.string().optional(),
  AI_SERVICE_TOKEN: z.string().optional(),

  // Where a crash is announced. Absent, nothing is sent and the error still
  // reaches the console, which is where it always went.
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),

  // Photo storage. Absent means the photo UI is simply not offered.
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

const parsed = envSchema.safeParse(process.env)

/** Human-readable configuration problems, empty when the environment is valid. */
export const envIssues: string[] = parsed.success
  ? []
  : parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)

export const env: Env = parsed.success
  ? parsed.data
  : {
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      NODE_ENV: (process.env.NODE_ENV as Env['NODE_ENV']) ?? 'development',
      SITE_URL: process.env.SITE_URL,
      LEGAL_CONTACT_EMAIL: process.env.LEGAL_CONTACT_EMAIL,
      NEXT_PUBLIC_ANALYTICS_ENABLED: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED,
      AUTH_USERNAME: process.env.AUTH_USERNAME,
      AUTH_PASSWORD: process.env.AUTH_PASSWORD,
      AUTH_SECRET: process.env.AUTH_SECRET,
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      AUTH_OWNER_EMAIL: process.env.AUTH_OWNER_EMAIL,
      AUTH_ALLOWED_EMAILS: process.env.AUTH_ALLOWED_EMAILS,
      AUTH_ALLOWED_DOMAINS: process.env.AUTH_ALLOWED_DOMAINS,
      AUTH_ALLOW_SIGNUP: process.env.AUTH_ALLOW_SIGNUP,
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
      CLOUDINARY_FOLDER: process.env.CLOUDINARY_FOLDER,
    }

// Read straight from process.env so this holds even when parsing failed.
export const isProduction = process.env.NODE_ENV === 'production'

/** Fail fast — for scripts, where a half-configured run is worse than no run. */
export function assertEnv(): void {
  if (envIssues.length === 0) return
  throw new Error(
    `Invalid environment configuration:\n${envIssues.map((issue) => `  - ${issue}`).join('\n')}`,
  )
}
