import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { DashboardGoal } from '@/server/services/dashboard'

const PACE_TONE = {
  ahead: 'good',
  on_track: 'accent',
  behind: 'warn',
  no_deadline: 'neutral',
  not_started: 'neutral',
} as const

/**
 * Progress always carries the real numbers underneath, never a bare percentage,
 * plus a pace verdict for anything with a deadline (spec 8.3).
 */
export function GoalList({ goals }: { goals: DashboardGoal[] }) {
  const t = useTranslations('goals')

  if (goals.length === 0) {
    return (
      <div className="px-4 pb-4">
        <p className="text-sm font-medium">{t('noneYet')}</p>
        <p className="mt-0.5 text-sm text-text-subtle">{t('noneYetBody')}</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3 px-4 pb-4">
      {goals.map((goal) => {
        const { percent, actual, target, pace, daysRemaining } = goal.progress
        return (
          <li key={goal.id} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Link href="/goals" className="min-w-0 truncate text-sm font-medium hover:underline">
                {goal.name}
              </Link>
              <span className="shrink-0 text-xs tabular-nums text-text-muted">
                {percent === null ? '—' : `${Math.round(percent)}%`}
              </span>
            </div>

            <Progress
              value={percent}
              tone={pace === 'behind' ? 'warn' : pace === 'ahead' ? 'good' : 'accent'}
              label={goal.name}
            />

            <div className="flex flex-wrap items-center gap-2 text-xs text-text-subtle">
              {actual !== null && target !== null ? (
                <span className="tabular-nums">
                  {t('progressOf', {
                    actual: Math.round(actual),
                    target: Math.round(target),
                  })}
                </span>
              ) : null}
              <Badge tone={PACE_TONE[pace]}>{t(`pace.${pace}`)}</Badge>
              {daysRemaining !== null ? (
                <span className="tabular-nums">{t('daysLeft', { count: daysRemaining })}</span>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
