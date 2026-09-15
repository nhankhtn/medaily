'use client'

import { CheckSquare, ChevronDown, ChevronRight, Loader2, Target } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Field } from '@/features/projects/project-dialog'
import { GoalFields } from '@/features/goals/goal-fields'
import type { PlanItem, PlanTask } from '@/lib/capture/plan-items'
import { fromISODate, type ISODate } from '@/lib/dates'
import type { GoalDraft } from '@/lib/goals/draft'
import { GOAL_PRIORITIES, type GoalPriority } from '@/lib/goals/options'
import { cn } from '@/lib/utils'
import { savePlan } from '@/server/actions/plan-capture'

type Row = { id: string; checked: boolean } & (
  { kind: 'goal'; goal: GoalDraft } | { kind: 'task'; task: PlanTask }
)

/**
 * What the model read out of the note, as a list to correct rather than a
 * result to accept. Every row can be renamed, retyped, unticked or opened up,
 * and nothing is written until the save is pressed.
 */
export function PlanReview({
  items,
  today,
  onSaved,
  onDiscard,
}: {
  items: PlanItem[]
  today: ISODate
  onSaved: () => void
  onDiscard: () => void
}) {
  const t = useTranslations('capture.plan')
  const tc = useTranslations('common')
  const [rows, setRows] = useState<Row[]>(() => items.map((item) => ({ ...item, checked: true })))
  const [openId, setOpenId] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()

  const patch = (id: string, next: Partial<Row>) =>
    setRows((previous) =>
      previous.map((row) => (row.id === id ? ({ ...row, ...next } as Row) : row)),
    )

  /** A misread kind is the likeliest mistake, so flipping one is a tap. */
  const flip = (row: Row) =>
    patch(
      row.id,
      row.kind === 'goal'
        ? {
            kind: 'task',
            task: {
              title: row.goal.name,
              dueDate: row.goal.targetDate,
              priority: row.goal.priority,
              estimateMinutes: null,
            },
          }
        : {
            kind: 'goal',
            goal: {
              name: row.task.title,
              description: null,
              category: 'life',
              priority: row.task.priority,
              startDate: today,
              targetDate: row.task.dueDate,
              progressMode: 'manual',
              metric: null,
              milestoneTitles: [],
            },
          },
    )

  const chosen = rows.filter((row) => row.checked)

  const save = () =>
    startSaving(async () => {
      const result = await savePlan({
        rows: chosen.map((row) =>
          row.kind === 'goal'
            ? {
                kind: 'goal' as const,
                ...row.goal,
                // A textarea leaves blank lines behind; the save takes titles.
                milestoneTitles: row.goal.milestoneTitles.filter((title) => title.trim() !== ''),
              }
            : { kind: 'task' as const, ...row.task },
        ),
      })

      if (!result.ok) {
        toast.error(tc('error'))
        return
      }
      if (result.failed > 0) {
        toast.warning(t('someFailed', { count: result.failed }))
        return
      }
      toast.success(t('saved', { count: result.goals + result.tasks }))
      onSaved()
    })

  return (
    <div className="space-y-3">
      <p className="text-text-subtle text-xs leading-snug">{t('reviewHint')}</p>

      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className={cn(
              'border-border-base rounded-[var(--radius)] border p-2',
              row.checked ? '' : 'opacity-50',
            )}
          >
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={row.checked}
                onChange={(event) => patch(row.id, { checked: event.target.checked })}
                aria-label={t('keep')}
                className="mt-2 size-4 shrink-0"
              />

              <div className="min-w-0 flex-1 space-y-1">
                <Input
                  value={row.kind === 'goal' ? row.goal.name : row.task.title}
                  onChange={(event) =>
                    patch(
                      row.id,
                      row.kind === 'goal'
                        ? { goal: { ...row.goal, name: event.target.value } }
                        : { task: { ...row.task, title: event.target.value } },
                    )
                  }
                  maxLength={300}
                  className="h-8 text-sm"
                />

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => flip(row)}
                    title={t(row.kind === 'goal' ? 'makeTask' : 'makeGoal')}
                    className="border-border-strong hover:bg-surface-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5"
                  >
                    {row.kind === 'goal' ? (
                      <Target className="size-3" />
                    ) : (
                      <CheckSquare className="size-3" />
                    )}
                    {t(`kinds.${row.kind}`)}
                  </button>

                  <span className="text-text-subtle min-w-0 flex-1 truncate">
                    <Summary row={row} />
                  </span>

                  <button
                    type="button"
                    onClick={() => setOpenId(openId === row.id ? null : row.id)}
                    className="text-text-subtle hover:text-text inline-flex items-center gap-1"
                  >
                    {openId === row.id ? (
                      <ChevronDown className="size-3" />
                    ) : (
                      <ChevronRight className="size-3" />
                    )}
                    {t('details')}
                  </button>
                </div>
              </div>
            </div>

            {openId === row.id ? (
              <div className="mt-2 pl-6">
                {row.kind === 'goal' ? (
                  <GoalFields
                    value={row.goal}
                    onChange={(goal) => patch(row.id, { kind: 'goal', goal })}
                  />
                ) : (
                  <TaskFields
                    value={row.task}
                    onChange={(task) => patch(row.id, { kind: 'task', task })}
                  />
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>
          {t('discard')}
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={saving || chosen.length === 0}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {t('save', { count: chosen.length })}
        </Button>
      </div>
    </div>
  )
}

/** The one line that says what a row will become, without opening it. */
function Summary({ row }: { row: Row }) {
  const t = useTranslations('capture.plan')
  const tg = useTranslations('goals')
  const format = useFormatter()

  const day = (date: ISODate) =>
    format.dateTime(fromISODate(date), { day: 'numeric', month: 'short' })

  if (row.kind === 'task') {
    return <>{row.task.dueDate ? t('due', { date: day(row.task.dueDate) }) : t('noDue')}</>
  }

  const { goal } = row
  const when = goal.targetDate ? t('due', { date: day(goal.targetDate) }) : tg('noDeadline')
  return (
    <>{`${tg(`categories.${goal.category}`)} · ${tg(`modes.${goal.progressMode}`)} · ${when}`}</>
  )
}

function TaskFields({ value, onChange }: { value: PlanTask; onChange: (next: PlanTask) => void }) {
  const t = useTranslations('capture.plan')
  const tp = useTranslations('projects')

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Field label={tp('dueDate')}>
        <Input
          type="date"
          value={value.dueDate ?? ''}
          onChange={(event) => onChange({ ...value, dueDate: event.target.value || null })}
        />
      </Field>
      <Field label={tp('priority')}>
        <Select
          value={value.priority}
          onChange={(event) => onChange({ ...value, priority: event.target.value as GoalPriority })}
        >
          {GOAL_PRIORITIES.map((option) => (
            <option key={option} value={option}>
              {tp(`priorities.${option}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('estimate')}>
        <Input
          type="number"
          min={0}
          max={10080}
          value={value.estimateMinutes ?? ''}
          onChange={(event) =>
            onChange({
              ...value,
              estimateMinutes: event.target.value === '' ? null : Number(event.target.value),
            })
          }
          className="text-center tabular-nums"
        />
      </Field>
    </div>
  )
}
