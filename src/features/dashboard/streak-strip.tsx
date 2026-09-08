import { Flame, Snowflake } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import type { DashboardStreak } from '@/server/services/dashboard'
import { cn } from '@/lib/utils'

const LABEL_KEYS: Record<string, string> = {
  logging: 'logging',
  study: 'study',
  deep_work: 'deepWork',
  exercise: 'exercise',
  reading: 'reading',
}

/**
 * Streaks show their value, their best, and — when the grace day is holding
 * them — say so. A broken streak shows the previous best and an invitation,
 * never a loss message (spec 20.3, 38.9).
 */
export function StreakStrip({ streaks }: { streaks: DashboardStreak[] }) {
  const t = useTranslations('streaks')

  return (
    <ul className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-4">
      {streaks.map((streak) => (
        <li
          key={streak.kind}
          className="rounded-[var(--radius)] border border-border-base bg-surface-2 px-3 py-2"
        >
          <p className="truncate text-xs text-text-muted">{t(LABEL_KEYS[streak.kind] ?? 'logging')}</p>
          <p className="mt-0.5 flex items-center gap-1.5">
            <Flame
              className={cn('size-4', streak.current > 0 ? 'text-warn' : 'text-text-subtle')}
            />
            <span className="text-lg font-semibold tabular-nums">{streak.current}</span>
            {streak.frozen ? (
              <span title={t('frozen')} aria-label={t('frozen')}>
                <Snowflake className="size-3.5 text-accent" />
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 truncate text-xs text-text-subtle">
            {streak.current === 0 && streak.best > 0
              ? t('startAgain', { count: streak.best })
              : streak.pendingToday
                ? t('pending')
                : t('best', { count: streak.best })}
          </p>
        </li>
      ))}
    </ul>
  )
}

export function StreakBadge({ frozen }: { frozen: boolean }) {
  const t = useTranslations('streaks')
  if (!frozen) return null
  return <Badge tone="accent">{t('frozen')}</Badge>
}
