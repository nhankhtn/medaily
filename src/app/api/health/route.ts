import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { readAccessPolicy, readAuthConfig, readGoogleConfig } from '@/lib/auth/config'

/**
 * Spec 30 — the only endpoint safe to expose. It reports liveness, migration
 * state, and *which* configuration is missing, by name only: never a value, a
 * connection string or a credential. That is enough to diagnose a broken
 * deploy from the outside without leaking anything.
 */
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

    return NextResponse.json(
      {
        status: missing.length === 0 ? 'ok' : 'degraded',
        database: 'reachable',
        migrationsApplied: applied[0]?.count ?? 0,
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
