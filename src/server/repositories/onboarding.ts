import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dailyLogs, goals, habits, weeklyReviews } from '@/lib/db/schema'
import type { OnboardingSignals } from '@/lib/onboarding'

/**
 * One round trip for the four counts the checklist derives from. Counting is
 * cheap and always current, which is why no progress flags are stored.
 */
export async function countOnboardingSignals(userId: string): Promise<OnboardingSignals> {
  const [logs, habitRows, goalRows, reviews] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(dailyLogs).where(eq(dailyLogs.userId, userId)),
    db.select({ count: sql<number>`count(*)::int` }).from(habits).where(eq(habits.userId, userId)),
    db.select({ count: sql<number>`count(*)::int` }).from(goals).where(eq(goals.userId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(weeklyReviews)
      .where(eq(weeklyReviews.userId, userId)),
  ])

  return {
    dailyLogCount: logs[0]?.count ?? 0,
    habitCount: habitRows[0]?.count ?? 0,
    goalCount: goalRows[0]?.count ?? 0,
    reviewCount: reviews[0]?.count ?? 0,
  }
}
