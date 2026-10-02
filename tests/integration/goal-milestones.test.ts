import { randomUUID } from 'node:crypto'
import { asc, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '@/lib/db/schema'
import { upsertMilestones } from '@/server/repositories/goals'

/**
 * One statement writes a whole list, which is two things worth proving against
 * a real database: each row updates from its own values, and an id belonging
 * to another goal still updates nothing.
 */
const url = process.env.DATABASE_URL
const describeDb = url ? describe : describe.skip

describeDb('writing a list of milestones', () => {
  const client = postgres(url ?? '', { max: 2 })
  const db = drizzle(client, { schema })

  const userId = randomUUID()
  const goalId = randomUUID()
  const otherGoalId = randomUUID()

  const goal = (id: string, name: string) => ({
    id,
    userId,
    name,
    progressMode: 'milestones' as const,
    startDate: '2026-01-01',
  })

  beforeAll(async () => {
    await db.insert(schema.users).values({ id: userId, displayName: 'milestones test' })
    await db.insert(schema.goals).values([goal(goalId, 'mine'), goal(otherGoalId, 'also mine')])
  })

  afterAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.id, userId))
    await client.end()
  })

  const listed = (id: string) =>
    db
      .select()
      .from(schema.goalMilestones)
      .where(eq(schema.goalMilestones.goalId, id))
      .orderBy(asc(schema.goalMilestones.sortOrder))

  it('inserts every row that arrives without an id', async () => {
    await upsertMilestones([
      { goalId, title: 'one', sortOrder: 0 },
      { goalId, title: 'two', sortOrder: 1 },
    ])

    expect((await listed(goalId)).map((row) => row.title)).toEqual(['one', 'two'])
  })

  /**
   * The point of `excluded`: without it every row in the batch would take the
   * first row's values, so a rename of the second would write the first again.
   */
  it('updates each row from its own values, not the first', async () => {
    const existing = await listed(goalId)
    await upsertMilestones([
      { id: existing[0]!.id, goalId, title: 'first renamed', sortOrder: 0 },
      { id: existing[1]!.id, goalId, title: 'second renamed', sortOrder: 1 },
    ])

    expect((await listed(goalId)).map((row) => row.title)).toEqual([
      'first renamed',
      'second renamed',
    ])
  })

  it('keeps what the caller did not send', async () => {
    const [first] = await listed(goalId)
    await db
      .update(schema.goalMilestones)
      .set({ weight: '3' })
      .where(eq(schema.goalMilestones.id, first!.id))

    await upsertMilestones([{ id: first!.id, goalId, title: 'renamed again', sortOrder: 0, weight: '3' }])

    const [after] = await listed(goalId)
    expect(after?.weight).toBe('3')
  })

  /**
   * `setWhere` is the whole security property: an id lifted from another goal
   * conflicts on the primary key and must then update nothing, rather than
   * quietly rewriting somebody else's milestone.
   */
  it('refuses an id that belongs to another goal', async () => {
    const [mine] = await listed(goalId)
    await upsertMilestones([{ goalId: otherGoalId, title: 'theirs', sortOrder: 0 }])

    await upsertMilestones([
      { id: mine!.id, goalId: otherGoalId, title: 'stolen', sortOrder: 9 },
    ])

    const untouched = (await listed(goalId)).find((row) => row.id === mine!.id)
    expect(untouched?.title, 'the other goal may not rewrite this row').toBe(mine!.title)
    expect(untouched?.goalId).toBe(goalId)
  })

  it('does nothing at all for an empty list', async () => {
    await expect(upsertMilestones([])).resolves.toEqual([])
  })
})
