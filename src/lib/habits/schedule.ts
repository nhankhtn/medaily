import { addDays, diffDays, eachDay, isoWeekday, weekStartOf, type DateRange, type ISODate } from '@/lib/dates'

export type HabitSchedule = {
  frequencyType: 'daily' | 'weekly' | 'specific_days' | 'interval'
  targetCount: number
  weekdays: number[] | null
  intervalDays: number | null
  startDate: ISODate
  endDate: ISODate | null
}

export function isActiveOn(habit: HabitSchedule, date: ISODate): boolean {
  if (date < habit.startDate) return false
  if (habit.endDate && date > habit.endDate) return false
  return true
}

/**
 * Whether a habit is scheduled on a given day. Unscheduled days never count
 * against completion rate or streaks (spec 7.2).
 */
export function isScheduledOn(habit: HabitSchedule, date: ISODate): boolean {
  if (!isActiveOn(habit, date)) return false

  switch (habit.frequencyType) {
    case 'daily':
      return true
    case 'weekly':
      // The whole week is the period; every active day is an opportunity.
      return true
    case 'specific_days':
      return (habit.weekdays ?? []).includes(isoWeekday(date))
    case 'interval': {
      const interval = habit.intervalDays ?? 1
      if (interval < 1) return false
      return diffDays(date, habit.startDate) % interval === 0
    }
  }
}

export type PeriodKey = { key: string; start: ISODate; end: ISODate }

/** The periods a habit is measured over inside a range (days, or weeks for `weekly`). */
export function periodsIn(
  habit: HabitSchedule,
  range: DateRange,
  weekStart: 'monday' | 'sunday',
): PeriodKey[] {
  if (habit.frequencyType === 'weekly') {
    const seen = new Set<string>()
    const out: PeriodKey[] = []
    for (const date of eachDay(range)) {
      if (!isActiveOn(habit, date)) continue
      const start = weekStartOf(date, weekStart)
      if (seen.has(start)) continue
      seen.add(start)
      out.push({ key: start, start, end: addDays(start, 6) })
    }
    return out
  }

  return eachDay(range)
    .filter((date) => isScheduledOn(habit, date))
    .map((date) => ({ key: date, start: date, end: date }))
}

export type HabitCompletion = {
  scheduledPeriods: number
  completedPeriods: number
  /** null when nothing was scheduled — displayed as "—", never as 0%. */
  rate: number | null
}

/** `counts` maps a date to the number of times the habit was done that date. */
export function computeCompletion(
  habit: HabitSchedule,
  range: DateRange,
  counts: Map<ISODate, number>,
  weekStart: 'monday' | 'sunday',
): HabitCompletion {
  const periods = periodsIn(habit, range, weekStart)
  let completed = 0

  for (const period of periods) {
    const total = eachDay({ start: period.start, end: period.end })
      .filter((d) => isActiveOn(habit, d))
      .reduce((sum, d) => sum + (counts.get(d) ?? 0), 0)
    if (total >= habit.targetCount) completed += 1
  }

  return {
    scheduledPeriods: periods.length,
    completedPeriods: completed,
    rate: periods.length ? completed / periods.length : null,
  }
}

/** Evaluates a metric-linked habit against a daily value (spec 7.3). */
export function evaluateLink(
  operator: 'gte' | 'lte' | 'eq',
  threshold: number,
  value: number | null,
): boolean {
  if (value === null) return false
  switch (operator) {
    case 'gte':
      return value >= threshold
    case 'lte':
      return value <= threshold
    case 'eq':
      return value === threshold
  }
}
