import { ACTIVITY_FIELDS, ESSENTIAL_FIELDS, REFLECTION_FIELDS } from '@/features/daily/types'
import type { DailyFormValues } from '@/features/daily/types'
import type { MetricKey } from '@/lib/types'

/**
 * Which questions the daily log stops asking.
 *
 * Hiding is not deleting: the column stays, yesterday's numbers stay, and
 * turning a field back on shows every one of them again. What it changes is
 * the form — and only the form, because the score already drops a component
 * with no data out of both the numerator and the divisor, so a field you
 * never answer costs you nothing rather than scoring zero.
 */
export const HIDEABLE_FIELDS = [
  ...ESSENTIAL_FIELDS,
  ...ACTIVITY_FIELDS,
  ...REFLECTION_FIELDS,
] as const

export type HideableField = (typeof HIDEABLE_FIELDS)[number]

const HIDEABLE = new Set<string>(HIDEABLE_FIELDS)

export const isHideableField = (value: unknown): value is HideableField =>
  typeof value === 'string' && HIDEABLE.has(value)

/**
 * The metric key a habit or a goal binds to, where the field has one. Hiding a
 * field that something is bound to is the one move that breaks quietly, so the
 * settings panel looks a field up here before it offers to turn it off.
 */
export const METRIC_OF: Partial<Record<HideableField, MetricKey>> = {
  energy: 'energy',
  mood: 'mood',
  sleepHours: 'sleep_hours',
  technicalStudyMinutes: 'technical_study_minutes',
  deepWorkMinutes: 'deep_work_minutes',
  exerciseMinutes: 'exercise_minutes',
  readingMinutes: 'reading_minutes',
  entertainmentMinutes: 'entertainment_minutes',
  englishMinutes: 'english_minutes',
}

/** Fields the timer writes to on its own when a run stops. */
export const TIMER_FILLS: readonly HideableField[] = [
  'technicalStudyMinutes',
  'deepWorkMinutes',
  'exerciseMinutes',
  'readingMinutes',
  'englishMinutes',
  'entertainmentMinutes',
]

/** Whatever was stored, reduced to fields that still exist. */
export function parseHiddenFields(value: unknown): HideableField[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter(isHideableField))]
}

/**
 * A hidden field still shows on a day that has a value in it. Six of these are
 * filled by the timer without anyone typing, and a number you cannot see is a
 * number you cannot correct — so hiding means "stop asking", not "hide what is
 * already there".
 */
export function fieldIsHidden(
  field: HideableField,
  hidden: readonly string[],
  values: DailyFormValues,
): boolean {
  return hidden.includes(field) && values[field] === null
}

export function visibleFields<T extends HideableField>(
  fields: readonly T[],
  hidden: readonly string[],
  values: DailyFormValues,
): T[] {
  return fields.filter((field) => !fieldIsHidden(field, hidden, values))
}
