import { describe, expect, it } from 'vitest'
import { groupByLogicalDay, reminderFor } from '@/server/services/log-reminder'

const row = (
  userId: string,
  overrides: Partial<{
    locale: 'en' | 'vi'
    timezone: string
    dayRolloverHour: number
  }> = {},
) => ({
  userId,
  locale: 'vi' as const,
  timezone: 'Asia/Ho_Chi_Minh',
  dayRolloverHour: 4,
  weekStart: 'monday' as const,
  ...overrides,
})

describe('groupByLogicalDay', () => {
  // 20:00 in Vietnam, which is when the cron fires.
  const evening = new Date('2026-10-02T13:00:00Z')

  it('puts people on the day it is for them, not for the server', () => {
    const groups = groupByLogicalDay(
      [
        row('vn'),
        // Their day turns over at 22:00, so at 20:00 it is still yesterday.
        row('late', { dayRolloverHour: 22 }),
        // 09:00 the same morning in New York.
        row('ny', { timezone: 'America/New_York', locale: 'en' }),
      ],
      evening,
    )

    expect(
      Object.fromEntries([...groups].map(([date, people]) => [date, people.map((p) => p.userId)])),
    ).toEqual({ '2026-10-02': ['vn', 'ny'], '2026-10-01': ['late'] })
  })

  it('carries each person’s language to the send', () => {
    const groups = groupByLogicalDay([row('a'), row('b', { locale: 'en' })], evening)
    expect(groups.get('2026-10-02')).toEqual([
      { userId: 'a', locale: 'vi' },
      { userId: 'b', locale: 'en' },
    ])
  })
})

describe('reminderFor', () => {
  it('speaks the person’s language and opens the daily log', async () => {
    const vi = await reminderFor('vi')
    const en = await reminderFor('en')

    expect(vi.title).toBe('Hôm nay chưa ghi gì')
    expect(en.title).toBe('Nothing logged today')
    for (const payload of [vi, en]) {
      expect(payload.body.length).toBeGreaterThan(0)
      expect(payload.url).toBe('/daily')
      // One tag, so tonight's replaces last night's on the lock screen.
      expect(payload.tag).toBe('log-reminder')
    }
  })
})
