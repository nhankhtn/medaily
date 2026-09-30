import { addMonthsISO, monthStartOf, today as todayOf, type ISODate } from '@/lib/dates'
import { copyBudgetsForward, findBudgets } from '@/server/repositories/finance'
import { dayContextOf, settingsOf } from '@/server/services/settings'

export type RolloverResult = { periodStart: ISODate; created: number }

/**
 * Carries a person's budgets into the month they are now in.
 *
 * Budgets are stored one row per category per month, so on the first of the
 * month the tab went blank and every figure had to be typed again. Almost
 * nobody rewrites their budget each month; what they want is last month's,
 * with the one or two lines that changed.
 *
 * Three rules keep it from ever overwriting a decision:
 *
 * - A month that already has any budget is left alone. Setting one figure for
 *   the new month is enough to mean "I am handling this month myself".
 * - Only forward, and only into the month running now. Filling in a past
 *   month after the fact would invent a plan nobody made — and the whole
 *   reason to look back at one is to see what was actually promised.
 * - The insert ignores conflicts, so running this twice writes nothing the
 *   second time. That is what lets it be checked daily instead of being timed
 *   to midnight in a timezone.
 */
export async function rolloverBudgets(userId: string): Promise<RolloverResult> {
  // Their own month, not the server's: the boundary this turns on is local,
  // and a job running at 17:00 UTC is already the next day in Vietnam.
  const settings = await settingsOf(userId)
  const periodStart = monthStartOf(todayOf(dayContextOf(settings)))

  if ((await findBudgets(userId, periodStart)).length > 0) return { periodStart, created: 0 }

  const created = await copyBudgetsForward(userId, addMonthsISO(periodStart, -1), periodStart)
  return { periodStart, created }
}
