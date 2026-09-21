'use client'

import { CalendarPlus, Check, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import type { ISODate } from '@/lib/dates'
import type { DayTask } from '@/server/services/day-plan'
import { removeTask, scheduleTask, toggleTask } from '@/server/actions/projects'
import { cn } from '@/lib/utils'

export function DayTasks({ tasks, scheduleTo }: { tasks: DayTask[]; scheduleTo?: ISODate }) {
  const t = useTranslations('calendar')
  const tc = useTranslations('common')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // The tick has to land before the server answers, or a row you just
  // finished sits there looking untouched for the length of a round trip.
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({})

  const schedule = (id: string) =>
    startTransition(async () => {
      try {
        const result = await scheduleTask({ id, dueDate: scheduleTo })
        if (!result.ok) {
          toast.error(tc('error'))
          return
        }
        router.refresh()
      } catch (error) {
        console.error('[calendar] could not put that task on a day:', error)
        toast.error(tc('error'))
      }
    })

  const remove = (id: string) =>
    startTransition(async () => {
      try {
        const result = await removeTask(id)
        if (!result.ok) {
          toast.error(tc('error'))
          return
        }
        router.refresh()
      } catch (error) {
        console.error('[calendar] could not delete that task:', error)
        toast.error(tc('error'))
      }
    })

  const toggle = (id: string, done: boolean) =>
    startTransition(async () => {
      setOptimistic((prev) => ({ ...prev, [id]: !done }))
      try {
        const result = await toggleTask(id)
        if (!result.ok) {
          setOptimistic((prev) => ({ ...prev, [id]: done }))
          toast.error(tc('error'))
          return
        }
        router.refresh()
      } catch (error) {
        setOptimistic((prev) => ({ ...prev, [id]: done }))
        console.error('[calendar] could not tick that task:', error)
        toast.error(tc('error'))
      }
    })

  return (
    <ul className="divide-border-base divide-y">
      {tasks.map((task) => {
        const done = optimistic[task.id] ?? task.status === 'done'

        return (
          <li key={task.id} className="group flex items-center gap-3 py-2">
            <button
              type="button"
              disabled={pending}
              aria-pressed={done}
              onClick={() => toggle(task.id, done)}
              aria-label={`${done ? t('markNotDone') : t('markDone')} ${task.title}`}
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full border',
                done
                  ? 'bg-good border-transparent text-accent-text'
                  : 'border-border-strong hover:border-accent',
              )}
            >
              {/* Only when done. A faint tick on an unfinished task was the
                  reason you could not tell the two states apart. */}
              {done ? <Check className="size-3" /> : null}
            </button>

            <span
              className={cn(
                'min-w-0 flex-1 truncate text-sm',
                done && 'text-text-subtle line-through',
              )}
            >
              {task.title}
            </span>

            {task.projectName ? (
              <span className="text-text-subtle shrink-0 truncate text-xs">{task.projectName}</span>
            ) : null}

            {task.overdue && !done ? (
              <Badge tone="warn" className={cn('shrink-0')}>
                {t('overdue')}
              </Badge>
            ) : null}

            {/* Visible on a phone, where there is no hover to reveal them. */}
            <span className="flex shrink-0 items-center gap-1 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              {scheduleTo ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => schedule(task.id)}
                  title={t('scheduleHere')}
                  aria-label={t('scheduleHere')}
                  className="text-text-subtle hover:text-accent p-1"
                >
                  <CalendarPlus className="size-4" />
                </button>
              ) : null}

              {/* The only way to be rid of a task that belongs to no project:
                  there is no project page to open for it. */}
              <button
                type="button"
                disabled={pending}
                aria-label={`${tc('delete')} ${task.title}`}
                onClick={() => remove(task.id)}
                className="text-text-subtle hover:text-bad p-1"
              >
                <Trash2 className="size-3.5" />
              </button>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
