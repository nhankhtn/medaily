import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '@/lib/db/schema'

/**
 * Multi-user turns "every repository filters by user_id" from a convention
 * into a security boundary. These tests prove the boundary holds with two
 * real users whose rows sit side by side in the same tables — the situation
 * the single-user app never actually produced.
 */
const url = process.env.DATABASE_URL
const describeDb = url ? describe : describe.skip

describeDb('multi-user isolation', () => {
  const client = postgres(url ?? '', { max: 2 })
  const db = drizzle(client, { schema })

  const alice = randomUUID()
  const bob = randomUUID()
  const today = new Date().toISOString().slice(0, 10)

  beforeAll(async () => {
    for (const [id, name, email] of [
      [alice, 'Alice', `alice-${id0()}@example.com`],
      [bob, 'Bob', `bob-${id0()}@example.com`],
    ] as const) {
      await db.insert(schema.users).values({ id, displayName: name, email })
      await db.insert(schema.userSettings).values({ userId: id })
    }

    await db.insert(schema.dailyLogs).values([
      { userId: alice, logDate: today, energy: 8, technicalStudyMinutes: 120 },
      { userId: bob, logDate: today, energy: 2, technicalStudyMinutes: 5 },
    ])

    await db.insert(schema.notes).values([
      { userId: alice, title: 'alice private note' },
      { userId: bob, title: 'bob private note' },
    ])
  })

  afterAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.id, alice))
    await db.delete(schema.users).where(eq(schema.users.id, bob))
    await client.end()
  })

  it('keeps daily logs apart even though they share a date', async () => {
    const rows = await db
      .select()
      .from(schema.dailyLogs)
      .where(eq(schema.dailyLogs.userId, alice))

    expect(rows).toHaveLength(1)
    expect(rows[0]?.energy).toBe(8)
  })

  /**
   * The unique key is (user_id, log_date), not log_date. Two people logging
   * the same day must both succeed — a global unique key would have made the
   * second one fail, and that is exactly the bug this asserts against.
   */
  it('lets two users log the same date', async () => {
    const rows = await db
      .select()
      .from(schema.dailyLogs)
      .where(eq(schema.dailyLogs.logDate, today))

    const mine = rows.filter((row) => row.userId === alice || row.userId === bob)
    expect(mine).toHaveLength(2)
  })

  it('scopes the effective-daily view by user', async () => {
    const rows = await db
      .select()
      .from(schema.dailyEffective)
      .where(eq(schema.dailyEffective.userId, bob))

    expect(rows).toHaveLength(1)
    expect(rows[0]?.energy).toBe(2)
    expect(rows.every((row) => row.userId === bob)).toBe(true)
  })

  it('scopes notes by user', async () => {
    const rows = await db.select().from(schema.notes).where(eq(schema.notes.userId, alice))
    expect(rows.map((row) => row.title)).toEqual(['alice private note'])
  })

  describe('auth identities', () => {
    it('refuses a second identity for the same provider account', async () => {
      const uid = `firebase-${id0()}`
      await db
        .insert(schema.authIdentities)
        .values({ userId: alice, provider: 'google', providerUid: uid })

      // Bob cannot claim Alice's Google account, whatever the app layer does.
      await expect(
        db
          .insert(schema.authIdentities)
          .values({ userId: bob, provider: 'google', providerUid: uid }),
      ).rejects.toThrow(/auth_identities_provider_uid_uniq/)
    })

    it('allows the same person two identities', async () => {
      const rows = await db
        .insert(schema.authIdentities)
        .values([
          { userId: bob, provider: 'google', providerUid: `g-${id0()}` },
          { userId: bob, provider: 'password', providerUid: `p-${id0()}` },
        ])
        .returning()

      expect(rows).toHaveLength(2)
    })

    it('takes identities with the user when the user is deleted', async () => {
      const doomed = randomUUID()
      await db.insert(schema.users).values({ id: doomed, displayName: 'Temp' })
      await db.insert(schema.userSettings).values({ userId: doomed })
      await db
        .insert(schema.authIdentities)
        .values({ userId: doomed, provider: 'google', providerUid: `g-${id0()}` })

      await db.delete(schema.users).where(eq(schema.users.id, doomed))

      const left = await db
        .select()
        .from(schema.authIdentities)
        .where(eq(schema.authIdentities.userId, doomed))
      expect(left).toHaveLength(0)
    })
  })

  /**
   * A handful of repository reads take a foreign id and no user id —
   * `findMilestonesFor`, `findWorkoutSets`, `findNoteTags`, `setNoteTags`.
   * They are safe only because every id reaching them was produced by a
   * query that already filtered on the owner. These tests pin that guard
   * down, since under multi-user the alternative is an IDOR.
   */
  describe('ids handed to unscoped reads are ownership-checked first', () => {
    it('refuses to update another user\'s note, so its id never reaches setNoteTags', async () => {
      const { upsertNote } = await import('@/server/repositories/knowledge')

      const mine = await upsertNote(alice, { title: 'alice note for guard test' })

      await expect(upsertNote(bob, { id: mine.id, title: 'stolen' })).rejects.toThrow(
        /note not found/,
      )

      const after = await db.select().from(schema.notes).where(eq(schema.notes.id, mine.id))
      expect(after[0]?.title).toBe('alice note for guard test')
      expect(after[0]?.userId).toBe(alice)
    })

    it('only ever collects milestones for goals the caller already owns', async () => {
      const { findGoals, findMilestonesFor } = await import('@/server/repositories/goals')

      const [aliceGoal] = await db
        .insert(schema.goals)
        .values({ userId: alice, name: 'alice goal', category: 'learning', startDate: today })
        .returning()
      const [bobGoal] = await db
        .insert(schema.goals)
        .values({ userId: bob, name: 'bob goal', category: 'learning', startDate: today })
        .returning()

      await db.insert(schema.goalMilestones).values([
        { goalId: aliceGoal!.id, title: 'alice milestone', sortOrder: 0 },
        { goalId: bobGoal!.id, title: 'bob milestone', sortOrder: 0 },
      ])

      // The dashboard's real call shape: ids come from a user-filtered read.
      const ids = (await findGoals(alice)).map((goal) => goal.id)
      const milestones = await findMilestonesFor(ids)

      expect(ids).toContain(aliceGoal!.id)
      expect(ids).not.toContain(bobGoal!.id)
      expect(milestones.map((row) => row.title)).toEqual(['alice milestone'])
    })
  })

  /**
   * Email is how a returning Google account finds the workspace it already
   * owns, so two users must never be able to hold the same address — in any
   * casing.
   */
  it('refuses two users with the same email, ignoring case', async () => {
    const address = `dup-${id0()}@example.com`
    const first = randomUUID()
    await db.insert(schema.users).values({ id: first, displayName: 'First', email: address })

    try {
      await expect(
        db
          .insert(schema.users)
          .values({ id: randomUUID(), displayName: 'Second', email: address.toUpperCase() }),
      ).rejects.toThrow(/users_email_uniq/)
    } finally {
      await db.delete(schema.users).where(eq(schema.users.id, first))
    }
  })
})

/** Short random suffix, so repeated local runs never collide on a unique index. */
function id0(): string {
  return randomUUID().slice(0, 8)
}
