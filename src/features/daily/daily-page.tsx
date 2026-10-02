import { getFormatter, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fromISODate, isBeforeRollover, wallHourOf, type ISODate } from '@/lib/dates'
import { PATHS } from '@/lib/paths'
import { getDailyFormData } from '@/server/services/daily'
import { getDayContext } from '@/server/services/settings'
import { getRunningTimer } from '@/server/services/timer'
import { DailyForm } from './daily-form'
import { DailySettingsDialog } from './daily-settings-dialog'
import { DateNav } from './date-nav'
import { DayTrail } from './day-trail'
import { StreakFlame } from './streak-flame'
import { valuesFromLog } from './types'

type PartOfDay = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'

function partOfDay(hour: number): PartOfDay {
  if (hour >= 4 && hour < 11) return 'morning'
  if (hour >= 11 && hour < 14) return 'noon'
  if (hour >= 14 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 22) return 'evening'
  return 'night'
}

/** Yesterday's energy as a tint: warm after a good day, cool after a flat one. */
function moodOf(energy: number | null): { mood: 'warm' | 'cool'; strength: number } | null {
  if (energy === null) return null
  if (energy >= 7) return { mood: 'warm', strength: (energy - 6) / 4 }
  if (energy <= 4) return { mood: 'cool', strength: (5 - energy) / 4 }
  return null
}

/** Shared by `/daily` (today) and `/daily/[date]`. */
export async function DailyPage({ date }: { date: ISODate }) {
  const [t, format, data, ctx, timer] = await Promise.all([
    getTranslations('daily'),
    getFormatter(),
    getDailyFormData(date),
    getDayContext(),
    // The header already asked; this is the cached answer.
    getRunningTimer().catch(() => null),
  ])

  const isToday = date === data.today
  const greeting = partOfDay(wallHourOf(ctx))
  const mood = moodOf(data.previousDay?.energy ?? null)
  const missingShown = data.missingDays.slice(-5)

  return (
    <div className="space-y-4">
      {mood ? (
        <div
          aria-hidden
          data-mood={mood.mood}
          className="daily-mood"
          style={{ '--mood-strength': mood.strength } as React.CSSProperties}
        />
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{t('title')}</h1>
            <StreakFlame streak={data.streak} today={data.today} />
          </div>
          <p className="text-sm text-text-muted">
            {isToday
              ? t(`greeting.${greeting}`, {
                  weekday: format.dateTime(fromISODate(date), 'weekdayLong'),
                })
              : t('subtitlePast', {
                  date: format.dateTime(fromISODate(date), 'fullDay'),
                })}
          </p>
          {isToday && isBeforeRollover(ctx) ? (
            <p className="text-accent text-xs">{t('greeting.rollover')}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <DailySettingsDialog
              hidden={data.hiddenFields}
              uses={data.metricUses}
              metrics={data.customMetrics}
            />
            <DateNav date={date} today={data.today} />
          </div>
          <DayTrail trail={data.streak.trail} date={date} today={data.today} />
        </div>
      </div>

      {data.missingDays.length >= 2 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-border-base bg-accent-soft px-4 py-3">
          <div className="flex items-center gap-3">
            <ul aria-hidden className="flex gap-1">
              {missingShown.map((day, index) => (
                <li
                  key={day}
                  style={{ '--i': index } as React.CSSProperties}
                  className="daily-nudge glass-inset flex size-8 flex-col items-center justify-center rounded-md border-dashed text-[10px] leading-tight"
                >
                  <span className="text-text-subtle">
                    {format.dateTime(fromISODate(day), 'weekdayNarrow')}
                  </span>
                  <span className="font-semibold tabular-nums">{fromISODate(day).getDate()}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-text">
              {t('catchUp.banner', { count: data.missingDays.length })}
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={PATHS.catchUp}>
              {t('catchUp.cta')}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      ) : null}

      <DailyForm
        key={date}
        date={date}
        initialValues={valuesFromLog(data.log)}
        effective={data.effective}
        medians={data.medians}
        exerciseTypes={data.exerciseTypes}
        existed={data.log !== null}
        customMetrics={data.customMetrics}
        initialCustom={data.customValues}
        hiddenFields={data.hiddenFields}
        today={data.today}
        streak={data.streak}
        timer={timer}
      />
    </div>
  )
}
