'use client'

import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { ProjectTask } from '@/lib/db/schema'
import { editTask, removeTask, saveTask, toggleTask } from '@/server/actions/projects'
import { cn } from '@/lib/utils'
import { formatDayMonth } from '@/lib/format/dates'

const PRIORITIES = ['low', 'medium', 'high'] as const

/**
 * Inline add that stays focused after Enter, so a list of tasks can be typed in
 * one pass instead of one dialog per row (spec 9). A row opens into the same
 * shape of fields it was typed in, rather than a dialog on top of the page.
 */
export function TaskList({ projectId, tasks }: { projectId: string; tasks: ProjectTask[] }) {
  const t = useTranslations('projects')
  const tc = useTranslations('common')
  const [draft, setDraft] = useState('')
  const [due, setDue] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
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

            if (editingId === task.id) {
              return (
                <li key={task.id} className="bg-surface-2 rounded-[var(--radius)] p-2">
                  <TaskEditor
                    task={task}
                    onClose={() => setEditingId(null)}
                    onSave={(patch) =>
                      startTransition(async () => {
                        const result = await editTask({ id: task.id, ...patch })
                        if (!result.ok) {
                          toast.error(tc('error'))
                          return
                        }
                        setEditingId(null)
                        toast.success(t('taskSaved'))
                      })
                    }
                    pending={pending}
                  />
                </li>
              )
            }

            return (
              <li
                key={task.id}
                className="group hover:bg-surface-2 flex items-center gap-2.5 rounded-[var(--radius)] px-1 py-1.5"
              >
                <button
                  type="button"
                  disabled={pending}
                  aria-pressed={done}
                  aria-label={`${t('markDone')} ${task.title}`}
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

                {/* The title is the target: tapping what you want to change is
                    how every list app behaves, and the pencil is for whoever
                    looks for a button instead. */}
                <button
                  type="button"
                  onClick={() => setEditingId(task.id)}
                  className={cn(
                    'min-w-0 flex-1 truncate text-left text-sm',
                    done && 'text-text-subtle line-through',
                  )}
                >
                  {task.title}
                </button>

                {task.priority !== 'medium' ? (
                  <span
                    className={cn(
                      'shrink-0 text-xs',
                      task.priority === 'high' ? 'text-bad' : 'text-text-subtle',
                    )}
                  >
                    {t(`priorities.${task.priority}`)}
                  </span>
                ) : null}

                {task.dueDate ? (
                  <span className="text-text-subtle shrink-0 text-xs tabular-nums">
                    {formatDayMonth(task.dueDate)}
                  </span>
                ) : null}

                {/* Visible on a phone, where there is no hover to reveal them. */}
                <span className="flex shrink-0 items-center gap-1 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={`${tc('edit')} ${task.title}`}
                    onClick={() => setEditingId(task.id)}
                    className="text-text-subtle hover:text-text p-1"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={`${tc('delete')} ${task.title}`}
                    onClick={() =>
                      startTransition(async () => {
                        await removeTask(task.id)
                      })
                    }
                    className="text-text-subtle hover:text-bad p-1"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

type Patch = { title: string; dueDate: string | null; priority: 'low' | 'medium' | 'high' }

function TaskEditor({
  task,
  onSave,
  onClose,
  pending,
}: {
  task: ProjectTask
  onSave: (patch: Patch) => void
  onClose: () => void
  pending: boolean
}) {
  const t = useTranslations('projects')
  const tc = useTranslations('common')
  const [title, setTitle] = useState(task.title)
  const [dueDate, setDueDate] = useState(task.dueDate ?? '')
  const [priority, setPriority] = useState(task.priority)

  const save = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    onSave({ title: trimmed, dueDate: dueDate || null, priority })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        autoFocus
        value={title}
        aria-label={t('addTask')}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            save()
          }
          if (event.key === 'Escape') onClose()
        }}
        className="min-w-40 flex-1"
      />
      <Input
        type="date"
        value={dueDate}
        aria-label={t('taskDue')}
        onChange={(event) => setDueDate(event.target.value)}
        className="w-40 shrink-0"
      />
      <Select
        value={priority}
        aria-label={t('priority')}
        onChange={(event) => setPriority(event.target.value as Patch['priority'])}
        className="w-auto shrink-0"
      >
        {PRIORITIES.map((value) => (
          <option key={value} value={value}>
            {t(`priorities.${value}`)}
          </option>
        ))}
      </Select>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          disabled={pending || title.trim() === ''}
          onClick={save}
          aria-label={tc('save')}
          className="bg-accent text-accent-text flex size-9 items-center justify-center rounded-[var(--radius)] disabled:opacity-50"
        >
          <Check className="size-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={tc('cancel')}
          className="text-text-subtle hover:text-text border-border-base flex size-9 items-center justify-center rounded-[var(--radius)] border"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
