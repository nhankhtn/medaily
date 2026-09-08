import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { achievements, portfolioItems, skills } from '@/lib/db/schema'
import type { Achievement, PortfolioItem, Skill } from '@/lib/db/schema'

export async function findSkills(userId: string): Promise<Skill[]> {
  return db
    .select()
    .from(skills)
    .where(and(eq(skills.userId, userId), isNull(skills.archivedAt)))
    .orderBy(asc(skills.category), asc(skills.name))
}

export async function upsertSkill(
  userId: string,
  values: Omit<typeof skills.$inferInsert, 'userId'> & { id?: string },
): Promise<Skill> {
  if (values.id) {
    const rows = await db
      .update(skills)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(skills.userId, userId), eq(skills.id, values.id)))
      .returning()
    const row = rows[0]
    if (!row) throw new Error('skill not found')
    return row
  }

  const rows = await db
    .insert(skills)
    .values({ ...values, userId })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert skill')
  return row
}

export async function findAchievements(userId: string): Promise<Achievement[]> {
  return db
    .select()
    .from(achievements)
    .where(eq(achievements.userId, userId))
    .orderBy(desc(achievements.achievedOn))
}

export async function insertAchievement(
  values: typeof achievements.$inferInsert,
): Promise<Achievement> {
  const rows = await db.insert(achievements).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert achievement')
  return row
}

export async function findPortfolio(userId: string): Promise<PortfolioItem[]> {
  return db
    .select()
    .from(portfolioItems)
    .where(eq(portfolioItems.userId, userId))
    .orderBy(desc(portfolioItems.createdAt))
}

export async function insertPortfolioItem(
  values: typeof portfolioItems.$inferInsert,
): Promise<PortfolioItem> {
  const rows = await db.insert(portfolioItems).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert portfolio item')
  return row
}
