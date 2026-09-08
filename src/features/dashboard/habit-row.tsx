'use client'

import { Check, Link2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { ISODate } from '@/lib/dates'
import { toggleHabit } from '@/server/actions/habits'
import type { DashboardHabit } from '@/server/services/dashboard'
import { cn } from '@/lib/utils'

/**
 * One tap per habit. A metric-linked habit is read-only here and says where its
 * state came from — the alternative is asking the user for the same fact twice.
 */
export function HabitRow({ habits, date }: { habits: DashboardHabit[]; date: ISODate }) {
  const t = useTranslations('habits')
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({})
  const [pending, startTransition] = useTransition()

  const scheduled = habits.filter((habit) => habit.scheduledToday)

  if (scheduled.length === 0) {
    return <p className="px-4 pb-4 text-sm text-text-subtle">{t('notScheduled')}</p>
  }

  const toggle = (habit: DashboardHabit) => {
    if (habit.derived) {
      toast.info(t('derivedFromLog'))
      return
    }
    const next = !(optimistic[habit.id] ?? habit.completedToday)
    setOptimistic((prev) => ({ ...prev, [habit.id]: next }))
    startTransition(async () => {
      const result = await toggleHabit({ habitId: habit.id, date })
      if (!result.ok) setOptimistic((prev) => ({ ...prev, [habit.id]: !next }))
    })
  }

  return (
    <ul className="space-y-1.5 px-4 pb-4">
      {scheduled.map((habit) => {
        const done = optimistic[habit.id] ?? habit.completedToday
        return (
          <li key={habit.id}>
            <button
              type="button"
              onClick={() => toggle(habit)}
              disabled={pending}
              aria-pressed={done}
              className={cn(
                'flex w-full items-center gap-3 rounded-[var(--radius)] border px-3 py-2.5 text-left transition-colors',
                done
                  ? 'border-transparent bg-good-soft'
                  : 'border-border-base bg-surface hover:bg-surface-2',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border',
                  done ? 'border-transparent bg-good text-white' : 'border-border-strong',
                )}
              >
                {done ? <Check className="size-3.5" /> : null}
              </span>

              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-sm', done && 'text-text')}>
                  {habit.name}
                </span>
                {habit.monthlyRate !== null ? (
                  <span className="block text-xs text-text-subtle">
                    {t('completionRate', { rate: Math.round(habit.monthlyRate * 100) })}
                  </span>
                ) : null}
              </span>

              {habit.derived ? (
                <span
                  className="flex items-center gap-1 text-xs text-text-subtle"
                  title={t('derivedFromLog')}
                >
                  <Link2 className="size-3.5" />
                </span>
              ) : null}

              {habit.currentStreak > 0 ? (
                <span className="shrink-0 text-xs tabular-nums text-text-subtle">
                  {habit.currentStreak}
                </span>
              ) : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
