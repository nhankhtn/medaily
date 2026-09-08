import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '@/lib/db/schema'

/**
 * Spec 31.2 — these run against a real PostgreSQL, because the point is to
 * prove the *database* rejects bad data and that the view and transactions
 * behave. Mocking the database here would test nothing.
 */
const url = process.env.DATABASE_URL
const describeDb = url ? describe : describe.skip

describeDb('database constraints and views', () => {
  const client = postgres(url ?? '', { max: 2 })
  const db = drizzle(client, { schema })

  // An isolated owner row per run, so these tests never touch real entries.
  const userId = randomUUID()
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10)

  beforeAll(async () => {
    await db.insert(schema.users).values({ id: userId, displayName: 'test' })
    await db.insert(schema.userSettings).values({ userId })
  })

  afterAll(async () => {
    // ON DELETE CASCADE removes every dependent row.
    await db.delete(schema.users).where(eq(schema.users.id, userId))
    await client.end()
  })

  /**
   * Drizzle wraps driver errors, so the constraint name lives on `cause`.
   * Asserting on it — rather than on any rejection — is what proves the
   * *database* refused the row, and refused it for the right reason.
   */
  async function failsWithConstraint(run: () => Promise<unknown>, constraint: RegExp) {
    let caught: unknown
    try {
      await run()
    } catch (error) {
      caught = error
    }

    expect(caught, 'expected the query to be rejected').toBeDefined()
    const cause = (caught as { cause?: { constraint_name?: string; message?: string } }).cause
    const detail =
      cause?.constraint_name ?? cause?.message ?? (caught as Error)?.message ?? ''
    expect(detail).toMatch(constraint)
  }

  it('enforces one log per user per date', async () => {
    await db.insert(schema.dailyLogs).values({ userId, logDate: today, energy: 7 })
    await failsWithConstraint(
      () => db.insert(schema.dailyLogs).values({ userId, logDate: today, energy: 8 }),
      /daily_logs_user_date_uniq/i,
    )
  })

  it('upserts on the same key instead of failing', async () => {
    const rows = await db
      .insert(schema.dailyLogs)
      .values({ userId, logDate: today, energy: 9, sleepHours: '7.5' })
      .onConflictDoUpdate({
        target: [schema.dailyLogs.userId, schema.dailyLogs.logDate],
        set: { energy: 9, sleepHours: '7.5' },
      })
      .returning()

    expect(rows[0]?.energy).toBe(9)
    expect(Number(rows[0]?.sleepHours)).toBe(7.5)
  })

  it('rejects an out-of-range energy value', async () => {
    await failsWithConstraint(
      () => db.insert(schema.dailyLogs).values({ userId, logDate: yesterday, energy: 11 }),
      /energy_range/i,
    )
  })

  it('rejects a negative minute value', async () => {
    await failsWithConstraint(
      () =>
        db
          .insert(schema.dailyLogs)
          .values({ userId, logDate: yesterday, technicalStudyMinutes: -5 }),
      /study_range/i,
    )
  })

  it('rejects a future log date', async () => {
    await failsWithConstraint(
      () => db.insert(schema.dailyLogs).values({ userId, logDate: future, energy: 5 }),
      /no_future_log/i,
    )
  })

  it('distinguishes a logged zero from a missing value', async () => {
    await db
      .insert(schema.dailyLogs)
      .values({ userId, logDate: yesterday, entertainmentMinutes: 0 })
    const rows = await db
      .select()
      .from(schema.dailyLogs)
      .where(and(eq(schema.dailyLogs.userId, userId), eq(schema.dailyLogs.logDate, yesterday)))

    expect(rows[0]?.entertainmentMinutes).toBe(0)
    expect(rows[0]?.readingMinutes).toBeNull()
  })

  it('resolves session minutes over the manual number in v_daily_effective', async () => {
    const before = await db
      .select()
      .from(schema.dailyEffective)
      .where(
        and(eq(schema.dailyEffective.userId, userId), eq(schema.dailyEffective.logDate, yesterday)),
      )
    // No sessions yet: the manual column shows through (null here).
    expect(before[0]?.sessionCount).toBe(0)

    await db.insert(schema.focusSessions).values([
      { userId, sessionDate: yesterday, minutes: 40, kind: 'learning' },
      { userId, sessionDate: yesterday, minutes: 20, kind: 'learning' },
      { userId, sessionDate: yesterday, minutes: 90, kind: 'deep_work' },
    ])

    const after = await db
      .select()
      .from(schema.dailyEffective)
      .where(
        and(eq(schema.dailyEffective.userId, userId), eq(schema.dailyEffective.logDate, yesterday)),
      )

    expect(after[0]?.effectiveStudyMinutes).toBe(60)
    expect(after[0]?.effectiveDeepWorkMinutes).toBe(90)
    expect(after[0]?.sessionCount).toBe(3)
  })

  it('rejects a focus session longer than a day', async () => {
    await failsWithConstraint(
      () => db.insert(schema.focusSessions).values({ userId, sessionDate: yesterday, minutes: 2000 }),
      /minutes_range/i,
    )
  })

  it('enforces one habit log per habit per date', async () => {
    const habit = await db
      .insert(schema.habits)
      .values({ userId, name: 'test habit', startDate: yesterday })
      .returning()
    const habitId = habit[0]?.id as string

    await db.insert(schema.habitLogs).values({ userId, habitId, logDate: yesterday, count: 1 })
    await failsWithConstraint(
      () => db.insert(schema.habitLogs).values({ userId, habitId, logDate: yesterday, count: 1 }),
      /habit_logs_habit_date_uniq/i,
    )
  })

  it('requires a complete metric binding on a linked habit', async () => {
    await failsWithConstraint(
      () =>
        db.insert(schema.habits).values({
          userId,
          name: 'incomplete link',
          startDate: yesterday,
          linkedMetric: 'sleep_hours',
        }),
      /link_complete/i,
    )
  })

  it('requires the metric fields on a metric goal', async () => {
    await failsWithConstraint(
      () =>
        db.insert(schema.goals).values({
          userId,
          name: 'bad goal',
          startDate: yesterday,
          progressMode: 'metric',
        }),
      /metric_mode_complete/i,
    )
  })

  it('rolls back the whole transaction when any statement fails', async () => {
    const before = await countLogs()

    await expect(
      db.transaction(async (tx) => {
        await tx
          .insert(schema.dailyLogs)
          .values({ userId, logDate: addDays(yesterday, -1), energy: 6 })
        // Same date twice inside one transaction: the unique index rejects it.
        await tx
          .insert(schema.dailyLogs)
          .values({ userId, logDate: addDays(yesterday, -1), energy: 7 })
      }),
    ).rejects.toThrow()

    expect(await countLogs()).toBe(before)
  })

  it('maintains updated_at through the trigger', async () => {
    const rows = await db
      .select()
      .from(schema.dailyLogs)
      .where(and(eq(schema.dailyLogs.userId, userId), eq(schema.dailyLogs.logDate, today)))
    const before = rows[0]?.updatedAt as Date

    await db
      .update(schema.dailyLogs)
      .set({ note: 'touched' })
      .where(and(eq(schema.dailyLogs.userId, userId), eq(schema.dailyLogs.logDate, today)))

    const after = await db
      .select()
      .from(schema.dailyLogs)
      .where(and(eq(schema.dailyLogs.userId, userId), eq(schema.dailyLogs.logDate, today)))

    expect((after[0]?.updatedAt as Date).getTime()).toBeGreaterThanOrEqual(before.getTime())
  })

  it('cascades deletes from the owner row', async () => {
    const scratchUser = randomUUID()
    await db.insert(schema.users).values({ id: scratchUser, displayName: 'scratch' })
    await db.insert(schema.dailyLogs).values({ userId: scratchUser, logDate: today, energy: 5 })

    await db.delete(schema.users).where(eq(schema.users.id, scratchUser))

    const remaining = await db
      .select()
      .from(schema.dailyLogs)
      .where(eq(schema.dailyLogs.userId, scratchUser))
    expect(remaining).toEqual([])
  })

  async function countLogs() {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.dailyLogs)
      .where(eq(schema.dailyLogs.userId, userId))
    return rows[0]?.count ?? 0
  }

  function addDays(date: string, amount: number) {
    const d = new Date(`${date}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + amount)
    return d.toISOString().slice(0, 10)
  }
})
