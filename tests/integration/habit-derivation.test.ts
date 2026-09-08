import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '@/lib/db/schema'
import { recomputeDerivedHabitLogs } from '@/server/services/habit-derivation'

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
