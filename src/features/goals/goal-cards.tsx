'use client'

import { Check, ChevronDown, GripVertical, Pencil } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GoalDialog } from '@/features/goals/goal-dialog'
import { Progress } from '@/components/ui/progress'
import { fromISODate } from '@/lib/dates'
import { reorderGoalsAction, setManualProgress, toggleMilestone } from '@/server/actions/goals'
import { useReorder } from '@/components/ui/use-reorder'
import type { BindableMetric } from '@/lib/metrics/bindable'
import type { GoalView } from '@/server/services/goals'
import { cn } from '@/lib/utils'

const PACE_TONE = {
  ahead: 'good',
  on_track: 'accent',
  behind: 'warn',
  no_deadline: 'neutral',
  not_started: 'neutral',
} as const

export function GoalCards({
  goals,
  today,
  metrics,
}: {
  goals: GoalView[]
  today: string
  metrics: BindableMetric[]
}) {
  const t = useTranslations('goals')
  const tc = useTranslations('common')
  const format = useFormatter()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const byId = new Map(goals.map((goal) => [goal.id, goal]))
  const { order, dragging, start, move, end, nudge } = useReorder({
    ids: goals.map((goal) => goal.id),
    onCommit: (ids) =>
      startTransition(async () => {
        const result = await reorderGoalsAction({ ids })
        if (!result.ok) toast.error(tc('error'))
      }),
  })

  if (goals.length === 0) {
    return (
      <div className="border-border-strong bg-surface rounded-[var(--radius)] border border-dashed p-6 text-center">
        <p className="font-medium">{t('noneYet')}</p>
        <p className="text-text-subtle mx-auto mt-1 max-w-prose text-sm">{t('noneYetBody')}</p>
        <div className="mt-4 flex justify-center">
          <GoalDialog today={today} metrics={metrics} />
        </div>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {order.map((id, index) => {
        const goal = byId.get(id)
        if (!goal) return null
        const { percent, actual, target, pace, daysRemaining, requiredRate } = goal.progress
        const open = expanded === goal.id

        return (
          <li
            key={goal.id}
            data-reorder-id={goal.id}
            className={cn(
              'border-border-base bg-surface rounded-[var(--radius)] border p-4',
              dragging === goal.id && 'ring-accent opacity-80 ring-2',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onPointerDown={start(goal.id)}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    nudge(goal.id, -1)
                  }
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    nudge(goal.id, 1)
                  }
                }}
                aria-label={t('reorder', { name: goal.name, position: index + 1, total: order.length })}
                // `touch-action: none` or the browser scrolls instead of dragging.
                className="text-text-subtle hover:text-text -mt-1 -ml-1 shrink-0 cursor-grab touch-none p-1 active:cursor-grabbing"
              >
                <GripVertical className="size-4" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{goal.name}</p>
                {goal.description ? (
                  <p className="text-text-subtle mt-0.5 line-clamp-2 text-sm">{goal.description}</p>
                ) : null}
              </div>
              <span className="flex shrink-0 items-center gap-1">
                <span className="text-lg font-semibold tabular-nums">
                  {percent === null ? '—' : `${Math.round(percent)}%`}
                </span>
                <GoalDialog
                  goal={goal}
                  today={today}
                  metrics={metrics}
                  trigger={
                    <Button variant="ghost" size="sm" className="h-7 px-1.5">
                      <Pencil className="size-3.5" />
                    </Button>
                  }
                />
              </span>
            </div>

            <Progress
              className="mt-3"
              value={percent}
              tone={pace === 'behind' ? 'warn' : pace === 'ahead' ? 'good' : 'accent'}
              label={goal.name}
            />

            <div className="text-text-subtle mt-2 flex flex-wrap items-center gap-2 text-xs">
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
                <span>{format.dateTime(fromISODate(goal.targetDate), 'dayMonthYear')}</span>
              ) : null}
            </div>

            {requiredRate !== null && requiredRate > 0 ? (
              <p className="text-text-muted mt-1.5 text-xs">
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
                  className="text-text-muted hover:text-text mt-3 flex items-center gap-1 text-xs"
                >
                  {goal.milestones.filter((m) => m.completed).length}/{goal.milestones.length}
                  <ChevronDown
                    className={cn('size-3.5 transition-transform', open && 'rotate-180')}
                  />
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
                          className="hover:bg-surface-2 flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm"
                        >
                          <span
                            className={cn(
                              'flex size-5 shrink-0 items-center justify-center rounded-full border',
                              milestone.completed
                                ? 'bg-good border-transparent text-white'
                                : 'border-border-strong',
                            )}
                          >
                            {milestone.completed ? <Check className="size-3" /> : null}
                          </span>
                          <span
                            className={cn(milestone.completed && 'text-text-subtle line-through')}
                          >
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
