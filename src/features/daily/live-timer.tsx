'use client'

import { useTranslations } from 'next-intl'
import { RollingNumber } from '@/components/ui/rolling-number'
import type { ActivityId } from '@/lib/timer/activities'
import { cn } from '@/lib/utils'
import type { RunningTimer } from '@/server/services/timer'
import { useElapsedSeconds } from '@/features/timer/use-run'
import type { DailyFormValues } from './types'

/** Which field a run of each built-in activity ends up in (spec 5.4, 10.3). */
const FIELD_OF: Partial<Record<ActivityId, keyof DailyFormValues>> = {
  learning: 'technicalStudyMinutes',
  deep_work: 'deepWorkMinutes',
  project: 'deepWorkMinutes',
  exercise: 'exerciseMinutes',
  reading: 'readingMinutes',
  entertainment: 'entertainmentMinutes',
  english: 'englishMinutes',
}

export const liveFieldOf = (timer: RunningTimer | null): keyof DailyFormValues | null =>
  timer ? (FIELD_OF[timer.activity] ?? null) : null

/**
 * A run feeding this field right now: a blinking dot and the minutes it will
 * add when it stops, ticking. Only the field the run belongs to mounts this,
 * so only one of them ticks.
 */
export function LiveTimer({ timer }: { timer: RunningTimer }) {
  const t = useTranslations('daily.live')
  const elapsed = useElapsedSeconds(timer)
  const running = timer.pausedAt === null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold',
        running ? 'bg-bad-soft text-bad' : 'bg-surface-2 text-text-subtle',
      )}
    >
      <span
        aria-hidden
        className={cn('size-1.5 rounded-full', running ? 'bg-bad daily-live' : 'bg-text-subtle')}
      />
      {running ? t('live') : t('paused')}
      <span className="font-normal">
        +<RollingNumber value={String(Math.floor(elapsed / 60))} />
        {t('minutes')}
      </span>
    </span>
  )
}
