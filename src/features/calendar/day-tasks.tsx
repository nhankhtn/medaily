'use client'

import { CalendarPlus, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import type { ISODate } from '@/lib/dates'
import type { DayTask } from '@/server/services/day-plan'
import { scheduleTask, toggleTask } from '@/server/actions/projects'
import { cn } from '@/lib/utils'

export function DayTasks({ tasks, scheduleTo }: { tasks: DayTask[]; scheduleTo?: ISODate }) {
  const t = useTranslations('calendar')
  const tc = useTranslations('common')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

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

  const toggle = (id: string) =>
    startTransition(async () => {
      try {
        const result = await toggleTask(id)
        if (!result.ok) {
          toast.error(tc('error'))
          return
        }
        router.refresh()
      } catch (error) {
        console.error('[calendar] could not tick that task:', error)
        toast.error(tc('error'))
      }
    })

  return (
    <ul className="divide-border-base divide-y">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-center gap-3 py-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => toggle(task.id)}
            aria-label={t('markDone')}
            className="border-border-strong hover:border-accent flex size-5 shrink-0 items-center justify-center rounded-full border"
          >
            <Check className="text-text-subtle size-3" />
          </button>

          <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>

          {task.projectName ? (
            <span className="text-text-subtle shrink-0 truncate text-xs">{task.projectName}</span>
          ) : null}

          {task.overdue ? (
            <Badge tone="warn" className={cn('shrink-0')}>
              {t('overdue')}
            </Badge>
          ) : null}

          {scheduleTo ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => schedule(task.id)}
              title={t('scheduleHere')}
              aria-label={t('scheduleHere')}
              className="text-text-subtle hover:text-accent shrink-0"
            >
              <CalendarPlus className="size-4" />
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
