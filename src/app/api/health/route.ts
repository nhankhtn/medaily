import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { readAccessPolicy, readAuthConfig, readGoogleConfig } from '@/lib/auth/config'
// Imported, not read from disk: this has to travel with the deployed bundle,
// and it is the only record of what migrations *this* build expects.
import journal from '../../../../drizzle/meta/_journal.json'

/**
 * Spec 30 — the only endpoint safe to expose. It reports liveness, migration
 * state, and *which* configuration is missing, by name only: never a value, a
 * connection string or a credential. That is enough to diagnose a broken
 * deploy from the outside without leaking anything.
 *
 * `pendingMigrations` is the one number worth reading first. Code deploys in a
 * minute and migrations never run themselves, so a deploy that is ahead of its
 * database fails on exactly the pages that use the new columns — which looks
 * like a bug in those pages and nothing else.
 */
const EXPECTED_MIGRATIONS = journal.entries.length

function driverReason(error: unknown): string {
  const cause = (error as { cause?: { message?: string } })?.cause
  const message = cause?.message ?? (error instanceof Error ? error.message : 'unknown')
  return message.replace(/\s+/g, ' ').slice(0, 200)
}

export async function GET() {
  const startedAt = Date.now()
  const auth = readAuthConfig()

  const missing = [
    !process.env.DATABASE_URL && 'DATABASE_URL',
    !process.env.AUTH_USERNAME && 'AUTH_USERNAME',
    !process.env.AUTH_PASSWORD && 'AUTH_PASSWORD',
    !process.env.AUTH_SECRET && 'AUTH_SECRET',
  ].filter((name): name is string => Boolean(name))

  const google = readGoogleConfig()
  const policy = readAccessPolicy()

  const config = {
    missingEnv: missing,
    authConfigured: auth.configured,
    // A set-but-too-short secret is a common and otherwise silent mistake.
    authSecretTooShort: Boolean(process.env.AUTH_SECRET) && process.env.AUTH_SECRET!.length < 16,
    // Names and counts only, never an address: this endpoint is public.
    googleConfigured: google.configured,
    googleClientConfigured:
      Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) &&
      Boolean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) &&
      Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    ownerEmailSet: policy.ownerEmail !== null,
    allowedEmailCount: policy.allowedEmails.length,
    allowedDomainCount: policy.allowedDomains.length,
    signupOpen: policy.allowSignup,
    // Whether crashes reach a phone. A boolean, like everything else here —
    // the token and the chat id never leave the deploy.
    alertsConfigured:
      Boolean(process.env.TELEGRAM_BOT_TOKEN) && Boolean(process.env.TELEGRAM_CHAT_ID),
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { status: 'error', database: 'not_configured', ...config, roundTripMs: Date.now() - startedAt },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    )
  }

  try {
    // Imported here, not at module scope: `lib/db` validates the environment on
    // import, and this endpoint has to keep answering precisely when that
    // validation would fail.
    const { db } = await import('@/lib/db')

    const applied = await db.execute<{ count: number }>(sql`
      SELECT COALESCE(
        (SELECT COUNT(*)::int FROM drizzle."__drizzle_migrations"),
        0
      ) AS count
    `)

    const migrationsApplied = applied[0]?.count ?? 0
    // Negative would mean the database is ahead of the code — a rollback, not
    // a missing migration. Either way nothing here is pending.
    const pendingMigrations = Math.max(0, EXPECTED_MIGRATIONS - migrationsApplied)

    return NextResponse.json(
      {
        status: missing.length === 0 && pendingMigrations === 0 ? 'ok' : 'degraded',
        database: 'reachable',
        migrationsApplied,
        migrationsExpected: EXPECTED_MIGRATIONS,
        pendingMigrations,
        ...config,
        roundTripMs: Date.now() - startedAt,
      },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        database: 'unreachable',
        // Drizzle wraps driver errors, so the useful text ("ECONNREFUSED",
        // "password authentication failed", "no pg_hba.conf entry") is on
        // `cause`. It names the host or the auth failure without echoing the
        // password, which is exactly what is needed to fix a deploy.
        reason: driverReason(error),
        ...config,
        roundTripMs: Date.now() - startedAt,
      },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    )
  }
}
