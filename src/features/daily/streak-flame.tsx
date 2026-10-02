'use client'

import { Flame, Snowflake } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { RollingNumber } from '@/components/ui/rolling-number'
import type { ISODate } from '@/lib/dates'
import type { LoggingStreak } from '@/lib/daily/trail'
import { cn } from '@/lib/utils'
import { useDayLogged } from './day-events'

/**
 * The logging streak beside the page title. It moves the moment today is saved
 * (or undone), and a grace day holding it is drawn as frost on the flame. A
 * broken streak shows the previous best and an invitation, never a loss
 * (spec 20.3).
 */
export function StreakFlame({ streak, today }: { streak: LoggingStreak; today: ISODate }) {
  const t = useTranslations('streaks')
  const loggedToday = useDayLogged(today, !streak.pendingToday)

  // `current` never counts a pending today, and always counts a logged one.
  const current =
    streak.current +
    (streak.pendingToday && loggedToday ? 1 : 0) -
    (!streak.pendingToday && !loggedToday ? 1 : 0)

  const [shown, setShown] = useState(current)
  const [cheer, setCheer] = useState(0)
  if (shown !== current) {
    if (current > shown) setCheer((n) => n + 1)
    setShown(current)
  }

  if (current === 0) {
    return streak.best > 0 ? (
      <span className="text-text-subtle text-xs">{t('startAgain', { count: streak.best })}</span>
    ) : null
  }

  return (
    <span
      title={
        streak.frozen
          ? t('frozenHint')
          : !loggedToday
            ? t('pending')
            : t('best', { count: streak.best })
      }
      className={cn(
        'glass inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-sm font-semibold',
        streak.frozen && 'ring-accent/40 ring-1',
      )}
    >
      <span className="relative inline-flex">
        <Flame
          key={cheer}
          aria-hidden
          className={cn(
            'size-4',
            loggedToday ? 'text-warn' : 'text-text-subtle',
            cheer > 0 && 'daily-flame',
          )}
        />
        {streak.frozen ? (
          <Snowflake aria-hidden className="text-accent absolute -right-1.5 -bottom-1 size-3" />
        ) : null}
      </span>
      <span aria-hidden>
        <RollingNumber value={String(current)} />
      </span>
      <span className="sr-only">{t('dayCount', { count: current })}</span>
    </span>
  )
}
