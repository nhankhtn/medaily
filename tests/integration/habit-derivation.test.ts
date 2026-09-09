import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '@/lib/db/schema'
import {
  backfillDerivedHabitLogs,
  recomputeDerivedHabitLogs,
} from '@/server/services/habit-derivation'

/**
 * The promise this covers (spec 7.3): a metric-linked habit is completed by the
 * daily log, in the same transaction, and never asks the user for the same fact
 * twice. It also has to *un*-complete when an edit makes the condition false.
 */
const url = process.env.DATABASE_URL
const describeDb = url ? describe : describe.skip

describeDb('derived habit logs', () => {
  const client = postgres(url ?? '', { max: 2 })
  // The service takes a transaction handle, so no Next.js request context is
  // needed — this is the real code path the daily save runs.
  const db = drizzle(client, { schema })

  const userId = randomUUID()
  const date = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  let sleepHabitId = ''
  let studyHabitId = ''
  let manualHabitId = ''

  beforeAll(async () => {
    await db.insert(schema.users).values({ id: userId, displayName: 'derivation test' })
    await db.insert(schema.userSettings).values({ userId })

    const habits = await db
      .insert(schema.habits)
      .values([
        {
          userId,
          name: 'Sleep 7h+',
          startDate: date,
          linkedMetric: 'sleep_hours',
          linkedOperator: 'gte',
          linkedThreshold: '7',
        },
        {
          userId,
          name: 'Study 30m',
          startDate: date,
          linkedMetric: 'technical_study_minutes',
          linkedOperator: 'gte',
          linkedThreshold: '30',
        },
        { userId, name: 'Manual habit', startDate: date },
      ])
      .returning()

    sleepHabitId = habits[0]?.id ?? ''
    studyHabitId = habits[1]?.id ?? ''
    manualHabitId = habits[2]?.id ?? ''
  })

  afterAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.id, userId))
    await client.end()
  })

  const logsFor = () =>
    db
      .select()
      .from(schema.habitLogs)
      .where(and(eq(schema.habitLogs.userId, userId), eq(schema.habitLogs.logDate, date)))

  it('completes a linked habit when the daily log satisfies it', async () => {
    await db
      .insert(schema.dailyLogs)
      .values({ userId, logDate: date, sleepHours: '7.5', technicalStudyMinutes: 45 })

    await db.transaction((tx) => recomputeDerivedHabitLogs(tx, userId, date, 'monday'))

    const logs = await logsFor()
    expect(logs).toHaveLength(2)
    expect(logs.every((log) => log.source === 'derived')).toBe(true)
    expect(logs.map((log) => log.habitId).sort()).toEqual([sleepHabitId, studyHabitId].sort())
  })

  it('removes the completion when an edit makes the condition false', async () => {
    await db
      .update(schema.dailyLogs)
      .set({ sleepHours: '6.0' })
      .where(and(eq(schema.dailyLogs.userId, userId), eq(schema.dailyLogs.logDate, date)))

    await db.transaction((tx) => recomputeDerivedHabitLogs(tx, userId, date, 'monday'))

    const logs = await logsFor()
    expect(logs.map((log) => log.habitId)).toEqual([studyHabitId])
  })

  it('prefers session minutes over the typed number', async () => {
    // Typed study drops below the threshold, but two sessions carry the day.
    await db
      .update(schema.dailyLogs)
      .set({ technicalStudyMinutes: 5 })
      .where(and(eq(schema.dailyLogs.userId, userId), eq(schema.dailyLogs.logDate, date)))

    await db.insert(schema.focusSessions).values([
      { userId, sessionDate: date, minutes: 25, kind: 'learning' },
      { userId, sessionDate: date, minutes: 20, kind: 'learning' },
    ])

    await db.transaction((tx) => recomputeDerivedHabitLogs(tx, userId, date, 'monday'))

    const logs = await logsFor()
    expect(logs.map((log) => log.habitId)).toEqual([studyHabitId])
  })

  it('never writes a log for an unlinked habit', async () => {
    const logs = await logsFor()
    expect(logs.some((log) => log.habitId === manualHabitId)).toBe(false)
  })

  it('does not complete anything for a day with no log at all', async () => {
    const emptyDate = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10)
    await db.transaction((tx) => recomputeDerivedHabitLogs(tx, userId, emptyDate, 'monday'))

    const logs = await db
      .select()
      .from(schema.habitLogs)
      .where(and(eq(schema.habitLogs.userId, userId), eq(schema.habitLogs.logDate, emptyDate)))
    expect(logs).toEqual([])
  })
})

/**
 * The gap that made a new habit look broken: it was created after the days had
 * been saved, so nothing ever ticked. Creating or re-binding a habit has to
 * catch those days up (spec 7.3).
 */
describeDb('backfilling a habit created after the fact', () => {
  const client = postgres(url ?? '', { max: 2 })
  const db = drizzle(client, { schema })

  const userId = randomUUID()
  const day = (offset: number) =>
    new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10)

  beforeAll(async () => {
    await db.insert(schema.users).values({ id: userId, displayName: 'backfill test' })
    await db.insert(schema.userSettings).values({ userId })

    // Three days recorded *before* any habit exists.
    await db.insert(schema.dailyLogs).values([
      { userId, logDate: day(3), sleepHours: '7.5', entertainmentMinutes: 30 },
      { userId, logDate: day(2), sleepHours: '6.0', entertainmentMinutes: 20 },
      { userId, logDate: day(1), sleepHours: '8.0', entertainmentMinutes: 200 },
    ])
  })

  afterAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.id, userId))
    await client.end()
  })

  it('ticks exactly the days that already satisfied the rule', async () => {
    const habits = await db
      .insert(schema.habits)
      .values([
        {
          userId,
          name: 'Sleep 7h+',
          startDate: day(30),
          linkedMetric: 'sleep_hours',
          linkedOperator: 'gte',
          linkedThreshold: '7',
        },
        {
          userId,
          name: 'Entertainment under 1h',
          startDate: day(30),
          linkedMetric: 'entertainment_minutes',
          linkedOperator: 'lte',
          linkedThreshold: '60',
        },
      ])
      .returning()

    const sleepHabit = habits[0]?.id
    const entertainmentHabit = habits[1]?.id

    const result = await db.transaction((tx) =>
      backfillDerivedHabitLogs(tx, userId, day(30), 'monday'),
    )
    // Only days with a log are visited — empty days have nothing to derive from.
    expect(result.days).toBe(3)

    const logs = await db
      .select()
      .from(schema.habitLogs)
      .where(eq(schema.habitLogs.userId, userId))

    const ticked = (habitId: string | undefined) =>
      logs.filter((log) => log.habitId === habitId).map((log) => log.logDate).sort()

    // 7.5 and 8.0 qualify; 6.0 does not.
    expect(ticked(sleepHabit)).toEqual([day(3), day(1)].sort())
    // 30 and 20 are under the cap; 200 is not.
    expect(ticked(entertainmentHabit)).toEqual([day(3), day(2)].sort())
    expect(logs.every((log) => log.source === 'derived')).toBe(true)
  })

  it('is idempotent — running it again changes nothing', async () => {
    const before = await db.select().from(schema.habitLogs).where(eq(schema.habitLogs.userId, userId))
    await db.transaction((tx) => backfillDerivedHabitLogs(tx, userId, day(30), 'monday'))
    const after = await db.select().from(schema.habitLogs).where(eq(schema.habitLogs.userId, userId))
    expect(after.length).toBe(before.length)
  })

  it('removes ticks when the threshold is raised beyond what was recorded', async () => {
    await db
      .update(schema.habits)
      .set({ linkedThreshold: '9' })
      .where(and(eq(schema.habits.userId, userId), eq(schema.habits.name, 'Sleep 7h+')))

    await db.transaction((tx) => backfillDerivedHabitLogs(tx, userId, day(30), 'monday'))

    const logs = await db
      .select()
      .from(schema.habitLogs)
      .innerJoin(schema.habits, eq(schema.habits.id, schema.habitLogs.habitId))
      .where(and(eq(schema.habitLogs.userId, userId), eq(schema.habits.name, 'Sleep 7h+')))

    // Nothing recorded reached 9 hours.
    expect(logs).toEqual([])
  })
})
