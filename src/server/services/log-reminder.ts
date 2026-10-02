import { createTranslator } from 'next-intl'
import { logicalDateOf, type ISODate } from '@/lib/dates'
import type { UserSettingsRow } from '@/lib/db/schema'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/config'
import { PATHS } from '@/lib/paths'
import { findUserIdsWithLogOn } from '@/server/repositories/daily'
import { findUserIdsWithTransactionOn } from '@/server/repositories/finance'
import { listPushDevices } from '@/server/repositories/push'
import { listSettings } from '@/server/repositories/settings'
import { notify, type PushPayload, type PushResult } from './push'

/**
 * The evening nudge: one notification to everybody whose day is still blank.
 *
 * "Blank" means no daily log *and* no transaction dated today. Either one is
 * the person having opened the app and written something down, and a reminder
 * after that would be nagging somebody who already did the thing.
 *
 * Only people with a device registered are considered at all — everybody else
 * could not be told — and there is no setting of its own: turning
 * notifications off for a device turns this off with it.
 */
export type ReminderRun = PushResult & {
  /** People with at least one device, whose day was looked at. */
  candidates: number
  /** Of those, the ones whose day was blank and who were sent the reminder. */
  reminded: number
}

export async function remindBlankDays(now: Date = new Date()): Promise<ReminderRun> {
  const devices = await listPushDevices()
  const userIds = [...new Set(devices.map((device) => device.userId))]
  const run: ReminderRun = {
    candidates: userIds.length,
    reminded: 0,
    sent: 0,
    dropped: 0,
    failed: 0,
  }
  if (userIds.length === 0) return run

  const settings = await listSettings({ userIds })
  const blank: { userId: string; locale: Locale }[] = []

  for (const [date, people] of groupByLogicalDay(settings, now)) {
    const ids = people.map((person) => person.userId)
    const [logged, spent] = await Promise.all([
      findUserIdsWithLogOn({ userIds: ids, date }),
      findUserIdsWithTransactionOn({ userIds: ids, occurredOn: date }),
    ])
    const wrote = new Set([...logged, ...spent])
    for (const person of people) {
      if (!wrote.has(person.userId)) blank.push(person)
    }
  }

  // One send per language rather than per person: `notify` already fans out
  // to every device of everybody it is handed.
  for (const locale of new Set(blank.map((person) => person.locale))) {
    const audience = blank.filter((person) => person.locale === locale).map((p) => p.userId)
    const result = await notify(audience, await reminderFor(locale))
    run.reminded += audience.length
    run.sent += result.sent
    run.dropped += result.dropped
    run.failed += result.failed
  }

  return run
}

/**
 * People bucketed by the day it is for *them* right now.
 *
 * The server's clock is the wrong answer: "today" is the person's timezone
 * and their rollover hour, so at 20:00 somebody whose day turns over at 22:00
 * is still on yesterday. Most accounts land in one bucket, which keeps the
 * lookups to one pair of queries.
 *
 * Someone with no settings row is skipped rather than guessed at; every
 * account gets one when it signs in, so this only drops a half-created user.
 */
export function groupByLogicalDay(
  settings: Pick<
    UserSettingsRow,
    'userId' | 'locale' | 'timezone' | 'dayRolloverHour' | 'weekStart'
  >[],
  now: Date,
): Map<ISODate, { userId: string; locale: Locale }[]> {
  const groups = new Map<ISODate, { userId: string; locale: Locale }[]>()
  for (const row of settings) {
    const date = logicalDateOf(now, {
      timezone: row.timezone,
      dayRolloverHour: row.dayRolloverHour,
      weekStart: row.weekStart,
    })
    const people = groups.get(date) ?? []
    people.push({ userId: row.userId, locale: isLocale(row.locale) ? row.locale : DEFAULT_LOCALE })
    groups.set(date, people)
  }
  return groups
}

/**
 * The words, in the person's own language.
 *
 * One tag for every reminder, so a retried run or tomorrow's replaces the one
 * still on the lock screen instead of stacking under it.
 */
export async function reminderFor(locale: Locale): Promise<PushPayload> {
  const messages = (await import(`../../../messages/${locale}.json`)).default
  const t = createTranslator({ locale, messages, namespace: 'logReminder' })
  return { title: t('title'), body: t('body'), url: PATHS.daily, tag: 'log-reminder' }
}
