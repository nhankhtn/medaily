'use client'

import { Check, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import type { ProjectTask } from '@/lib/db/schema'
import { removeTask, saveTask, toggleTask } from '@/server/actions/projects'
import { cn } from '@/lib/utils'
import { formatDayMonth } from '@/lib/format/dates'

/**
 * Inline add that stays focused after Enter, so a list of tasks can be typed in
 * one pass instead of one dialog per row (spec 9).
 */
export function TaskList({ projectId, tasks }: { projectId: string; tasks: ProjectTask[] }) {
  const t = useTranslations('projects')
  const tc = useTranslations('common')
  const [draft, setDraft] = useState('')
  const [due, setDue] = useState('')
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({})
  const [pending, startTransition] = useTransition()

  const add = () => {
    const title = draft.trim()
    if (!title) return
    setDraft('')
    setDue('')
    startTransition(async () => {
      const result = await saveTask({ projectId, title, dueDate: due || null })
      if (!result.ok) toast.error(tc('error'))
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Plus className="text-text-subtle size-4 shrink-0" />
        <Input
          value={draft}
          placeholder={t('addTask')}
          aria-label={t('addTask')}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add()
            }
          }}
        />
        <Input
          type="date"
          value={due}
          onChange={(event) => setDue(event.target.value)}
          aria-label={t('taskDue')}
          className="w-40 shrink-0"
        />
      </div>

      {tasks.length === 0 ? (
        <p className="text-text-subtle px-1 py-2 text-sm">{t('noTasks')}</p>
      ) : (
        <ul className="space-y-1">
          {tasks.map((task) => {
            const done = optimistic[task.id] ?? task.status === 'done'
            return (
              <li
                key={task.id}
                className="group hover:bg-surface-2 flex items-center gap-2.5 rounded-[var(--radius)] px-1 py-1.5"
              >
                <button
                  type="button"
                  disabled={pending}
                  aria-pressed={done}
                  aria-label={task.title}
                  onClick={() => {
                    setOptimistic((prev) => ({ ...prev, [task.id]: !done }))
                    startTransition(async () => {
                      const result = await toggleTask(task.id)
                      if (!result.ok) setOptimistic((prev) => ({ ...prev, [task.id]: done }))
                    })
                  }}
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border',
                    done ? 'bg-good border-transparent text-white' : 'border-border-strong',
                  )}
                >
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

                {task.dueDate ? (
                  <span className="text-text-subtle shrink-0 text-xs tabular-nums">
                    {formatDayMonth(task.dueDate)}
                  </span>
                ) : null}

                <button
                  type="button"
                  disabled={pending}
                  aria-label={`${tc('delete')} ${task.title}`}
                  onClick={() =>
                    startTransition(async () => {
                      await removeTask(task.id)
                    })
                  }
                  className="text-text-subtle shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
