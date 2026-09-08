'use client'

import { Check, ChevronDown } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { fromISODate } from '@/lib/dates'
import { setManualProgress, toggleMilestone } from '@/server/actions/goals'
import type { GoalView } from '@/server/services/goals'
import { cn } from '@/lib/utils'

const PACE_TONE = {
  ahead: 'good',
  on_track: 'accent',
  behind: 'warn',
  no_deadline: 'neutral',
  not_started: 'neutral',
} as const

export function GoalCards({ goals }: { goals: GoalView[] }) {
  const t = useTranslations('goals')
  const format = useFormatter()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (goals.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-border-base bg-surface p-6 text-center">
        <p className="font-medium">{t('noneYet')}</p>
        <p className="mt-1 text-sm text-text-subtle">{t('noneYetBody')}</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {goals.map((goal) => {
        const { percent, actual, target, pace, daysRemaining, requiredRate } = goal.progress
        const open = expanded === goal.id

        return (
          <li
            key={goal.id}
            className="rounded-[var(--radius)] border border-border-base bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{goal.name}</p>
                {goal.description ? (
                  <p className="mt-0.5 line-clamp-2 text-sm text-text-subtle">{goal.description}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-lg font-semibold tabular-nums">
                {percent === null ? '—' : `${Math.round(percent)}%`}
              </span>
            </div>

            <Progress
              className="mt-3"
              value={percent}
              tone={pace === 'behind' ? 'warn' : pace === 'ahead' ? 'good' : 'accent'}
              label={goal.name}
            />

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-subtle">
              {actual !== null && target !== null ? (
                <span className="tabular-nums">
                  {t('progressOf', { actual: Math.round(actual), target: Math.round(target) })}
                </span>
              ) : null}
              <Badge tone={PACE_TONE[pace]}>{t(`pace.${pace}`)}</Badge>
              <Badge>{t(`status.${goal.status}`)}</Badge>
              {daysRemaining !== null ? (
                <span className="tabular-nums">{t('daysLeft', { count: daysRemaining })}</span>
              ) : (
                <span>{t('noDeadline')}</span>
              )}
              {goal.targetDate ? (
                <span>
                  {format.dateTime(fromISODate(goal.targetDate), {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              ) : null}
            </div>

            {requiredRate !== null && requiredRate > 0 ? (
              <p className="mt-1.5 text-xs text-text-muted">
                {t('requiredRate', { rate: Math.ceil(requiredRate) })}
              </p>
            ) : null}

            {goal.progressMode === 'manual' ? (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  defaultValue={percent ?? 0}
                  aria-label={goal.name}
                  className="h-9 flex-1 accent-[var(--accent)]"
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    startTransition(async () => {
                      await setManualProgress({ goalId: goal.id, percent: value })
                    })
                  }}
                />
              </div>
            ) : null}

            {goal.milestones.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : goal.id)}
                  aria-expanded={open}
                  className="mt-3 flex items-center gap-1 text-xs text-text-muted hover:text-text"
                >
                  {goal.milestones.filter((m) => m.completed).length}/{goal.milestones.length}
                  <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
                </button>

                {open ? (
                  <ul className="mt-2 space-y-1">
                    {goal.milestones.map((milestone) => (
                      <li key={milestone.id}>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              const result = await toggleMilestone({
                                goalId: goal.id,
                                milestoneId: milestone.id,
                              })
                              if (result.ok && result.allComplete) {
                                toast.success(t('status.completed'))
                              }
                            })
                          }
                          className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm hover:bg-surface-2"
                        >
                          <span
                            className={cn(
                              'flex size-5 shrink-0 items-center justify-center rounded-full border',
                              milestone.completed
                                ? 'border-transparent bg-good text-white'
                                : 'border-border-strong',
                            )}
                          >
                            {milestone.completed ? <Check className="size-3" /> : null}
                          </span>
                          <span className={cn(milestone.completed && 'text-text-subtle line-through')}>
                            {milestone.title}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
