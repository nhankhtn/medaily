import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import * as schema from '@/lib/db/schema'

/**
 * A child row has no owner of its own — a milestone belongs to whoever owns
 * its goal, a tag on a note to whoever owns the note. So rewriting `user_id`
 * is not what keeps one person's import or click out of another person's
 * data; checking the parent is. These prove that check is there.
 */
const session = vi.hoisted(() => ({ userId: '' }))
vi.mock('@/lib/auth/current-user', () => ({
  getCurrentUserId: async () => session.userId,
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const url = process.env.DATABASE_URL
const describeDb = url ? describe : describe.skip

describeDb('ownership of child rows', () => {
  const client = postgres(url ?? '', { max: 2 })
  const db = drizzle(client, { schema })

  const alice = randomUUID()
  const bob = randomUUID()
  const bobGoal = randomUUID()
  const bobMilestone = randomUUID()
  const bobNote = randomUUID()
  const aliceTag = randomUUID()

  beforeAll(async () => {
    for (const [id, name] of [
      [alice, 'Alice'],
      [bob, 'Bob'],
    ] as const) {
      await db.insert(schema.users).values({ id, displayName: name, email: `${id}@example.com` })
      await db.insert(schema.userSettings).values({ userId: id })
    }
    await db
      .insert(schema.goals)
      .values({ id: bobGoal, userId: bob, name: 'bob goal', startDate: '2026-01-01' })
    await db
      .insert(schema.goalMilestones)
      .values({ id: bobMilestone, goalId: bobGoal, title: 'bob milestone' })
    await db.insert(schema.notes).values({ id: bobNote, userId: bob, title: 'bob note' })
    await db.insert(schema.tags).values({ id: aliceTag, userId: alice, name: `tag-${aliceTag}` })
    session.userId = alice
  })

  afterAll(async () => {
    await db.delete(schema.users).where(inArray(schema.users.id, [alice, bob]))
    await client.end()
  })

  function payload(tables: Record<string, Record<string, unknown>[]>) {
    return { app: 'personal-os', schemaVersion: 1, exportedAt: new Date().toISOString(), tables }
  }

  it('refuses an imported milestone or note tag that points at someone else', async () => {
    const { importPayload } = await import('@/server/services/export')
    const intruder = randomUUID()

    const summary = await importPayload(
      payload({
        goal_milestones: [{ id: intruder, goal_id: bobGoal, title: 'planted' }],
        note_tags: [{ note_id: bobNote, tag_id: aliceTag }],
      }),
      false,
    )

    expect(summary.ok).toBe(true)
    expect(summary.inserted).toMatchObject({ goal_milestones: 0, note_tags: 0 })
    expect(summary.skipped).toMatchObject({ goal_milestones: 1, note_tags: 1 })

    const planted = await db
      .select()
      .from(schema.goalMilestones)
      .where(eq(schema.goalMilestones.id, intruder))
    expect(planted).toHaveLength(0)
    const tagged = await db
      .select()
      .from(schema.noteTags)
      .where(eq(schema.noteTags.noteId, bobNote))
    expect(tagged).toHaveLength(0)
  })

  it('still imports a milestone whose goal comes in the same file', async () => {
    const { importPayload } = await import('@/server/services/export')
    const goal = randomUUID()
    const milestone = randomUUID()

    const summary = await importPayload(
      payload({
        goals: [{ id: goal, user_id: bob, name: 'mine now', start_date: '2026-01-01' }],
        goal_milestones: [{ id: milestone, goal_id: goal, title: 'first step' }],
      }),
      false,
    )

    expect(summary.inserted).toMatchObject({ goals: 1, goal_milestones: 1 })
    const [row] = await db.select().from(schema.goals).where(eq(schema.goals.id, goal))
    expect(row?.userId).toBe(alice)
  })

  it('does not let one person tick off another person’s milestone', async () => {
    const { toggleMilestone } = await import('@/server/actions/goals')

    const result = await toggleMilestone({ goalId: bobGoal, milestoneId: bobMilestone })

    expect(result).toEqual({ ok: false, error: 'not_found' })
    const [row] = await db
      .select()
      .from(schema.goalMilestones)
      .where(eq(schema.goalMilestones.id, bobMilestone))
    expect(row?.completedAt).toBeNull()
  })
})
