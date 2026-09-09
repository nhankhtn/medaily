'use client'

import { Archive, Link2, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Field } from '@/features/projects/project-dialog'
import { METRIC_KEYS, type MetricKey } from '@/lib/types'
import type { ISODate } from '@/lib/dates'
import { archiveHabit, saveHabit } from '@/server/actions/habits'
import type { HabitView } from '@/server/services/habits'
import { cn } from '@/lib/utils'

const FREQUENCIES = ['daily', 'weekly', 'specific_days', 'interval'] as const
const CATEGORIES = ['health', 'knowledge', 'career', 'finance', 'life'] as const
const OPERATORS = ['gte', 'lte', 'eq'] as const
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const

/** Sensible starting thresholds, so the form is never a blank number box. */
const SUGGESTED_THRESHOLD: Partial<Record<MetricKey, number>> = {
  energy: 7,
  mood: 7,
  sleep_hours: 7,
  technical_study_minutes: 30,
  deep_work_minutes: 60,
  focus_minutes: 90,
  exercise_minutes: 20,
  reading_minutes: 10,
  reading_pages: 10,
  entertainment_minutes: 60,
  english_minutes: 15,
}

export function HabitDialog({
  habit,
  today,
  trigger,
}: {
  habit?: HabitView
  today: ISODate
  trigger?: React.ReactNode
}) {
  const t = useTranslations('habits')
  const tc = useTranslations('common')
  const tm = useTranslations('metricNames')
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const [frequency, setFrequency] = useState<(typeof FREQUENCIES)[number]>(
    habit?.frequencyType ?? 'daily',
  )
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5])
  const [linked, setLinked] = useState(Boolean(habit?.linkedMetric))
  const [metric, setMetric] = useState<MetricKey>((habit?.linkedMetric as MetricKey) ?? 'sleep_hours')
  const [operator, setOperator] = useState<(typeof OPERATORS)[number]>(
    (habit?.linkedOperator as (typeof OPERATORS)[number]) ?? 'gte',
  )
  const [threshold, setThreshold] = useState<string>(
    habit?.linkedThreshold !== null && habit?.linkedThreshold !== undefined
      ? String(habit.linkedThreshold)
      : String(SUGGESTED_THRESHOLD.sleep_hours),
  )

  // Changing the metric moves the threshold to that metric's own scale, so
  // "sleep ≥ 30" cannot happen by leaving a minutes value behind.
  const pickMetric = (next: MetricKey) => {
    setMetric(next)
    setThreshold(String(SUGGESTED_THRESHOLD[next] ?? 1))
    if (next === 'entertainment_minutes') setOperator('lte')
    else setOperator('gte')
  }

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveHabit({
        id: habit?.id,
        name: String(formData.get('name') ?? ''),
        category: formData.get('category'),
        frequencyType: frequency,
        targetCount: Number(formData.get('targetCount') ?? 1),
        weekdays: frequency === 'specific_days' ? weekdays : null,
        intervalDays: frequency === 'interval' ? Number(formData.get('intervalDays') ?? 7) : null,
        linkedMetric: linked ? metric : null,
        linkedOperator: linked ? operator : null,
        linkedThreshold: linked ? Number(threshold) : null,
        startDate: String(formData.get('startDate') ?? today),
        notes: String(formData.get('notes') ?? ''),
      })

      if (!result.ok) {
        toast.error(result.detail ?? tc('error'))
        return
      }

      toast.success(t('saved'))
      // The point of backfill is that it is visible: say how much it caught up.
      if (result.backfilledDays > 0) {
        toast.info(t('backfilled', { count: result.backfilledDays }))
      }
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" />
            {t('create')}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent title={habit ? t('edit') : t('create')}>
        <form action={submit} className="space-y-3">
          <Field label={t('name')}>
            <Input name="name" defaultValue={habit?.name} required autoFocus maxLength={120} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('category')}>
              <Select name="category" defaultValue={habit?.category ?? 'health'}>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t(`categories.${category}`)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('frequency')}>
              <Select
                value={frequency}
                onChange={(event) => setFrequency(event.target.value as typeof frequency)}
              >
                {FREQUENCIES.map((option) => (
                  <option key={option} value={option}>
                    {t(`frequencies.${option}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Each frequency asks only for what it needs. */}
          {frequency === 'weekly' ? (
            <Field label={t('targetCountWeekly')}>
              <Input
                type="number"
                name="targetCount"
                min={1}
                max={50}
                defaultValue={habit?.targetCount ?? 4}
                className="w-24 text-center tabular-nums"
              />
            </Field>
          ) : frequency === 'specific_days' ? (
            <Field label={t('weekdays')}>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((day) => {
                  const active = weekdays.includes(day)
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setWeekdays((prev) =>
                          prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
                        )
                      }
                      className={cn(
                        'h-9 min-w-11 rounded-full border px-2 text-xs font-medium',
                        active
                          ? 'border-transparent bg-accent text-accent-text'
                          : 'border-border-base bg-surface-2 text-text-muted',
                      )}
                    >
                      {t(`weekdayShort.${day}`)}
                    </button>
                  )
                })}
              </div>
              <input type="hidden" name="targetCount" value={1} />
            </Field>
          ) : frequency === 'interval' ? (
            <Field label={t('intervalDays')}>
              <Input
                type="number"
                name="intervalDays"
                min={1}
                max={365}
                defaultValue={habit?.targetCount ? 7 : 7}
                className="w-24 text-center tabular-nums"
              />
              <input type="hidden" name="targetCount" value={1} />
            </Field>
          ) : (
            <Field label={t('targetCountDaily')}>
              <Input
                type="number"
                name="targetCount"
                min={1}
                max={50}
                defaultValue={habit?.targetCount ?? 1}
                className="w-24 text-center tabular-nums"
              />
            </Field>
          )}

          {/* The feature that makes habits worth having (spec 7.3). */}
          <div className="space-y-2 rounded-[var(--radius)] border border-border-base bg-surface-2 p-3">
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={linked}
                onChange={(event) => setLinked(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
              />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Link2 className="size-3.5 text-accent" />
                  {t('autoTick')}
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-text-subtle">
                  {t('autoTickHint')}
                </span>
              </span>
            </label>

            {linked ? (
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                  <Field label={t('metric')}>
                    <Select
                      value={metric}
                      onChange={(event) => pickMetric(event.target.value as MetricKey)}
                    >
                      {METRIC_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {tm(key)}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label={t('operator')}>
                    <Select
                      value={operator}
                      onChange={(event) => setOperator(event.target.value as typeof operator)}
                    >
                      {OPERATORS.map((option) => (
                        <option key={option} value={option}>
                          {t(`operators.${option}`)}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label={t('threshold')}>
                    <Input
                      type="number"
                      step="0.5"
                      min={0}
                      value={threshold}
                      onChange={(event) => setThreshold(event.target.value)}
                      className="w-24 text-center tabular-nums"
                    />
                  </Field>
                </div>

                <p className="text-xs text-accent">
                  {t('linkPreview', {
                    metric: tm(metric),
                    operator: t(`operators.${operator}`),
                    threshold,
                  })}
                </p>
              </div>
            ) : (
              <p className="text-xs text-text-subtle">{t('noLink')}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('startDate')}>
              <Input
                type="date"
                name="startDate"
                max={today}
                defaultValue={habit ? undefined : today}
              />
            </Field>
          </div>

          <Field label={t('notes')}>
            <Textarea name="notes" rows={2} />
          </Field>

          <div className="flex items-center justify-between gap-2 pt-1">
            {habit ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                title={t('archiveHint')}
                onClick={() =>
                  startTransition(async () => {
                    await archiveHabit(habit.id)
                    toast.success(t('archived'))
                    setOpen(false)
                  })
                }
              >
                <Archive className="size-4" />
                {t('archive')}
              </Button>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={pending}>
                {tc('save')}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
