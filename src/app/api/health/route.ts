import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Spec 30 — the only endpoint that is safe to expose publicly. It reports
 * liveness and migration state, and never any personal data.
 */
export async function GET() {
  const startedAt = Date.now()

  try {
    const rows = await db.execute<{ migrations: number }>(sql`
      SELECT COUNT(*)::int AS migrations
      FROM information_schema.tables
      WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
    `)

    const applied = await db.execute<{ count: number }>(sql`
      SELECT COALESCE(
        (SELECT COUNT(*)::int FROM drizzle."__drizzle_migrations"),
        0
      ) AS count
    `)

    return NextResponse.json(
      {
        status: 'ok',
        database: 'reachable',
        migrationsTablePresent: (rows[0]?.migrations ?? 0) > 0,
        migrationsApplied: applied[0]?.count ?? 0,
        roundTripMs: Date.now() - startedAt,
      },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch {
    return NextResponse.json(
      { status: 'error', database: 'unreachable', roundTripMs: Date.now() - startedAt },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    )
  }
}
