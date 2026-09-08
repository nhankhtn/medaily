'use client'

import { Check, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import type { ProjectTask } from '@/lib/db/schema'
import { removeTask, saveTask, toggleTask } from '@/server/actions/projects'
import { cn } from '@/lib/utils'

/**
 * Inline add that stays focused after Enter, so a list of tasks can be typed in
 * one pass instead of one dialog per row (spec 9).
 */
export function TaskList({ projectId, tasks }: { projectId: string; tasks: ProjectTask[] }) {
  const t = useTranslations('projects')
  const tc = useTranslations('common')
  const [draft, setDraft] = useState('')
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({})
  const [pending, startTransition] = useTransition()

  const add = () => {
    const title = draft.trim()
    if (!title) return
    setDraft('')
    startTransition(async () => {
      const result = await saveTask({ projectId, title })
      if (!result.ok) toast.error(tc('error'))
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Plus className="size-4 shrink-0 text-text-subtle" />
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
      </div>

      {tasks.length === 0 ? (
        <p className="px-1 py-2 text-sm text-text-subtle">{t('noTasks')}</p>
      ) : (
        <ul className="space-y-1">
          {tasks.map((task) => {
            const done = optimistic[task.id] ?? task.status === 'done'
            return (
              <li
                key={task.id}
                className="group flex items-center gap-2.5 rounded-[var(--radius)] px-1 py-1.5 hover:bg-surface-2"
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
                    done ? 'border-transparent bg-good text-white' : 'border-border-strong',
                  )}
                >
                  {done ? <Check className="size-3" /> : null}
                </button>

                <span className={cn('min-w-0 flex-1 truncate text-sm', done && 'text-text-subtle line-through')}>
                  {task.title}
                </span>

                {task.dueDate ? (
                  <span className="shrink-0 text-xs tabular-nums text-text-subtle">
                    {task.dueDate.slice(5)}
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
                  className="shrink-0 text-text-subtle opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
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
