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
/**
 * 32 bytes, written as base64 — which is 43 characters and a '='. Matched as
 * text rather than decoded, because this module is read on the client too and
 * `Buffer` is not there.
 */
const base64Key = z
  .string()
  .regex(/^[A-Za-z0-9+/]{43}=$/, 'must be 32 bytes of base64 (43 characters and an =)')

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
  // Google One Tap's OAuth web client id. Declared here for the same reason as
  // the rest: the browser reads it straight off `process.env` — Next only
  // inlines that exact expression — but a variable the server cannot see is a
  // variable nothing can report as missing.
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().optional(),
  // Whether chat updates arrive by themselves. Off, chat still works — it asks
  // on a slow timer instead, which is what the password sign-in path gets
  // anyway since it has no Firebase session to listen with.
  NEXT_PUBLIC_REALTIME_ENABLED: z.string().optional(),

  /*
   * The Web Push certificate key pair. Public by design: it identifies the
   * project to the browser's push service and authorises nothing. Blank and the
   * notifications card never appears — sending uses FIREBASE_SERVICE_ACCOUNT,
   * which then also needs `roles/firebasemessaging.admin`.
   */
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: z.string().optional(),

  /*
   * One capability token, minted by `scripts/grant-token.ts`, holding who may
   * write and what they may write — see docs/operations. Blank and the
   * endpoint answers 503 to everyone.
   *
   * The key that opens it is derived from AUTH_SECRET, so there is no second
   * secret here; rotating AUTH_SECRET therefore invalidates the token.
   */
  GRANT_TOKEN: z.string().optional(),
  /**
   * Wanted by messaging, not by sign-in. Without it no token is ever issued,
   * so a deploy with a VAPID key and no sender id offers notifications that
   * cannot be turned on.
   */
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
  /**
   * Analytics, and messaging — which asks Installations to name this browser
   * before it will issue a token, and Installations will not do that without
   * an app id. Sign-in works without it.
   */
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().optional(),
  // Analytics only. The counter does not start without it; nothing else cares.
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: z.string().optional(),

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

  // What the scheduler sends back so the sweep route knows the request is
  // the platform's and not the open internet's. Absent, the route refuses.
  CRON_SECRET: z.string().optional(),

  // The activity log's own database. Absent, nothing is recorded and no driver
  // connects — the trail is simply not offered, like every other optional
  // service here.
  MONGODB_URI: z.string().optional(),
  // How long a trail is kept, enforced by a TTL index rather than by anyone
  // remembering. A log that grows forever is a liability, not an asset.
  ACTIVITY_LOG_DAYS: z.coerce.number().int().min(1).max(3650).default(90),

  /*
   * Locks the words of a chat message before they reach Mongo. The key stays
   * on the server, so this guards the database — a dump, a backup, whoever
   * runs the cluster — and not the machine itself. Absent, messages are
   * written as they always were.
   *
   * SPARE opens everything the main key does: the way back in after a lost
   * key, and the way through a rotation. Checked for length here rather than
   * at the first message, because a key that is quietly the wrong size fails
   * in the one place nobody is watching.
   */
  CHAT_MESSAGE_KEY: base64Key.optional(),
  CHAT_MESSAGE_KEY_SPARE: base64Key.optional(),

  /*
   * The only Firebase credential with any power in this app, and the only
   * thing that uses it is the nightly sweep of orphaned doorbell documents.
   * Absent, nothing is swept and nothing complains — the garbage is a few
   * hundred bytes a room and harmless.
   *
   * The whole service-account JSON, pasted as one value. Two variables would
   * mean a private key with real newlines in an environment variable, which is
   * the classic way to spend an afternoon; inside JSON they stay escaped and
   * `JSON.parse` restores them.
   *
   * Needs `roles/datastore.user` and nothing more.
   */
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),

  // Photo storage. Absent means the photo UI is simply not offered.
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

/**
 * `FOO=` in an env file means *not set*, not "set to the empty string".
 *
 * That is how everyone reads such a line, and it is the only reading that lets
 * `.env.example` list every variable uncommented — which is the point of that
 * file, since a key commented out is a key nobody knows exists. Zod disagrees
 * by default: an empty string is a string, so `LEGAL_CONTACT_EMAIL=` fails as
 * a malformed address, `AUTH_SECRET=` as too short, and `ACTIVITY_LOG_DAYS=`
 * coerces to zero and takes the schema's own default with it.
 */
function unsetBlanks(source: NodeJS.ProcessEnv): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [
      key,
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    ]),
  )
}

const parsed = envSchema.safeParse(unsetBlanks(process.env))

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
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      NEXT_PUBLIC_REALTIME_ENABLED: process.env.NEXT_PUBLIC_REALTIME_ENABLED,
      NEXT_PUBLIC_FIREBASE_VAPID_KEY: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      GRANT_TOKEN: process.env.GRANT_TOKEN,
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
        process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
      AUTH_OWNER_EMAIL: process.env.AUTH_OWNER_EMAIL,
      AUTH_ALLOWED_EMAILS: process.env.AUTH_ALLOWED_EMAILS,
      AUTH_ALLOWED_DOMAINS: process.env.AUTH_ALLOWED_DOMAINS,
      AUTH_ALLOW_SIGNUP: process.env.AUTH_ALLOW_SIGNUP,
      MONGODB_URI: process.env.MONGODB_URI,
      ACTIVITY_LOG_DAYS: Number(process.env.ACTIVITY_LOG_DAYS) || 90,
      CHAT_MESSAGE_KEY: process.env.CHAT_MESSAGE_KEY,
      CHAT_MESSAGE_KEY_SPARE: process.env.CHAT_MESSAGE_KEY_SPARE,
      FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT,
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
