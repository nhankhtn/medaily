'use client'

import { Check, Flame, Link2, Pencil, Snowflake } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HabitDialog } from '@/features/habits/habit-dialog'
import type { ISODate } from '@/lib/dates'
import { toggleHabit } from '@/server/actions/habits'
import type { HabitView } from '@/server/services/habits'
import { cn } from '@/lib/utils'

const CELL_TONE = {
  hit: 'bg-good',
  miss: 'bg-border-strong',
  pending: 'bg-accent-soft border border-accent',
  not_scheduled: 'bg-surface-2',
} as const

export function HabitList({ habits, today }: { habits: HabitView[]; today: ISODate }) {
  const t = useTranslations('habits')
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({})
  const [pending, startTransition] = useTransition()

  if (habits.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-dashed border-border-strong bg-surface p-6 text-center">
        <p className="font-medium">{t('noneYet')}</p>
        <p className="mx-auto mt-1 max-w-prose text-sm text-text-subtle">{t('noneYetBody')}</p>
        <div className="mt-4 flex justify-center">
          <HabitDialog today={today} />
        </div>
      </div>
    )
  }

  const toggle = (habit: HabitView) => {
    if (habit.linkedMetric) {
      toast.info(t('derivedFromLog'))
      return
    }
    const next = !(optimistic[habit.id] ?? habit.completedToday)
    setOptimistic((prev) => ({ ...prev, [habit.id]: next }))
    startTransition(async () => {
      const result = await toggleHabit({ habitId: habit.id, date: today })
      if (!result.ok) setOptimistic((prev) => ({ ...prev, [habit.id]: !next }))
    })
  }

  return (
    <ul className="space-y-2">
      {habits.map((habit) => {
        const done = optimistic[habit.id] ?? habit.completedToday
        const weekly = habit.frequencyType === 'weekly'

        return (
          <li
            key={habit.id}
            className="rounded-[var(--radius)] border border-border-base bg-surface p-3"
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => toggle(habit)}
                disabled={pending || (!habit.scheduledToday && !weekly)}
                aria-pressed={done}
                aria-label={habit.name}
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors',
                  done
                    ? 'border-transparent bg-good text-white'
                    : habit.scheduledToday || weekly
                      ? 'border-border-strong hover:bg-surface-2'
                      : 'border-border-base opacity-40',
                )}
              >
                {done ? <Check className="size-4" /> : null}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{habit.name}</span>
                  {habit.linkedMetric ? (
                    <Badge tone="accent">
                      <Link2 className="size-3" />
                      {t('derivedFromLog')}
                    </Badge>
                  ) : null}
                  {weekly ? (
                    <Badge>
                      {habit.weekCompleted}/{habit.targetCount}
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-subtle">
                  <span className="flex items-center gap-1">
                    <Flame className={cn('size-3.5', habit.currentStreak > 0 && 'text-warn')} />
                    <span className="tabular-nums">{habit.currentStreak}</span>
                    {habit.frozen ? <Snowflake className="size-3 text-accent" /> : null}
                  </span>
                  {habit.monthlyRate !== null ? (
                    <span className="tabular-nums">
                      {t('completionRate', { rate: Math.round(habit.monthlyRate * 100) })}
                    </span>
                  ) : null}
                  <HabitDialog
                    habit={habit}
                    today={today}
                    trigger={
                      <Button variant="ghost" size="sm" className="ml-auto h-6 px-1.5">
                        <Pencil className="size-3" />
                      </Button>
                    }
                  />
                  {!habit.scheduledToday && !weekly ? <span>{t('notScheduled')}</span> : null}
                </div>

                {/* 28-day grid: unscheduled days are visibly different from misses */}
                <div className="mt-2 flex flex-wrap gap-[3px]">
                  {habit.grid.map((cell) => (
                    <span
                      key={cell.date}
                      title={`${cell.date} · ${cell.status}`}
                      className={cn('size-3 rounded-[3px]', CELL_TONE[cell.status])}
                    />
                  ))}
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
