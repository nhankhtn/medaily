'use client'

import { Archive, Plus } from 'lucide-react'
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
import { archiveGoal, saveGoal } from '@/server/actions/goals'
import type { GoalView } from '@/server/services/goals'

const MODES = ['manual', 'metric', 'milestones'] as const
const CATEGORIES = ['career', 'health', 'finance', 'knowledge', 'life'] as const
const PRIORITIES = ['low', 'medium', 'high'] as const
const AGGREGATIONS = ['sum', 'avg', 'count_days', 'latest'] as const
const PERIODS = ['total', 'weekly', 'monthly'] as const
const DIRECTIONS = ['at_least', 'at_most'] as const

/** A starting target that matches the metric's own scale. */
const SUGGESTED_TARGET: Partial<Record<MetricKey, number>> = {
  technical_study_minutes: 300,
  deep_work_minutes: 600,
  focus_minutes: 900,
  exercise_minutes: 150,
  reading_minutes: 120,
  reading_pages: 100,
  entertainment_minutes: 600,
  english_minutes: 100,
  sleep_hours: 7,
  energy: 7,
  mood: 7,
}

export function GoalDialog({
  goal,
  today,
  trigger,
}: {
  goal?: GoalView
  today: ISODate
  trigger?: React.ReactNode
}) {
  const t = useTranslations('goals')
  const tc = useTranslations('common')
  const tm = useTranslations('metricNames')
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const [mode, setMode] = useState<(typeof MODES)[number]>(goal?.progressMode ?? 'metric')
  const [metric, setMetric] = useState<MetricKey>(
    (goal?.metricKey as MetricKey) ?? 'technical_study_minutes',
  )
  const [aggregation, setAggregation] = useState<(typeof AGGREGATIONS)[number]>('sum')
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(
    (goal?.metricPeriod as (typeof PERIODS)[number]) ?? 'weekly',
  )
  const [direction, setDirection] = useState<(typeof DIRECTIONS)[number]>(
    goal?.metricDirection ?? 'at_least',
  )
  const [target, setTarget] = useState<string>(
    goal?.progress.target !== null && goal?.progress.target !== undefined
      ? String(goal.progress.target)
      : String(SUGGESTED_TARGET.technical_study_minutes),
  )

  const pickMetric = (next: MetricKey) => {
    setMetric(next)
    setTarget(String(SUGGESTED_TARGET[next] ?? 1))
    // Entertainment is the metric people cap rather than chase.
    setDirection(next === 'entertainment_minutes' ? 'at_most' : 'at_least')
    setAggregation(next === 'sleep_hours' || next === 'energy' || next === 'mood' ? 'avg' : 'sum')
  }

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const milestoneTitles = String(formData.get('milestones') ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)

      const result = await saveGoal({
        id: goal?.id,
        name: String(formData.get('name') ?? ''),
        description: String(formData.get('description') ?? ''),
        category: formData.get('category'),
        status: goal?.status ?? 'active',
        priority: formData.get('priority'),
        startDate: String(formData.get('startDate') ?? today),
        targetDate: String(formData.get('targetDate') ?? '') || null,
        progressMode: mode,
        progressManual: mode === 'manual' ? Number(formData.get('progressManual') ?? 0) : null,
        metricKey: mode === 'metric' ? metric : null,
        metricAggregation: mode === 'metric' ? aggregation : null,
        metricPeriod: mode === 'metric' ? period : null,
        metricTarget: mode === 'metric' ? Number(target) : null,
        metricDirection: mode === 'metric' ? direction : null,
        milestoneTitles: mode === 'milestones' ? milestoneTitles : undefined,
      })

      if (!result.ok) {
        toast.error(result.detail ?? tc('error'))
        return
      }
      toast.success(t('saved'))
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

      <DialogContent title={goal ? t('edit') : t('create')}>
        <form action={submit} className="space-y-3">
          <Field label={t('name')}>
            <Input name="name" defaultValue={goal?.name} required autoFocus maxLength={200} />
          </Field>

          <Field label={t('description')}>
            <Textarea name="description" defaultValue={goal?.description ?? ''} rows={2} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('category')}>
              <Select name="category" defaultValue={goal?.category ?? 'knowledge'}>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t(`categories.${category}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('priority')}>
              <Select name="priority" defaultValue={goal?.priority ?? 'medium'}>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {t(`priorities.${priority}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('startDate')}>
              <Input type="date" name="startDate" defaultValue={goal?.startDate ?? today} />
            </Field>
            <Field label={t('targetDate')}>
              <Input type="date" name="targetDate" defaultValue={goal?.targetDate ?? ''} />
            </Field>
          </div>

          <Field label={t('progressMode')}>
            <Select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
              {MODES.map((option) => (
                <option key={option} value={option}>
                  {t(`modes.${option}`)}
                </option>
              ))}
            </Select>
          </Field>

          {/* Only the chosen mode's fields are shown, and only they are sent. */}
          {mode === 'manual' ? (
            <Field label={t('manualValue')}>
              <Input
                type="number"
                name="progressManual"
                min={0}
                max={100}
                defaultValue={goal?.progress.percent ?? 0}
                className="w-24 text-center tabular-nums"
              />
            </Field>
          ) : mode === 'metric' ? (
            <div className="space-y-2 rounded-[var(--radius)] border border-border-base bg-surface-2 p-3">
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

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label={t('aggregation')}>
                  <Select
                    value={aggregation}
                    onChange={(event) => setAggregation(event.target.value as typeof aggregation)}
                  >
                    {AGGREGATIONS.map((option) => (
                      <option key={option} value={option}>
                        {t(`aggregations.${option}`)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t('period')}>
                  <Select
                    value={period}
                    onChange={(event) => setPeriod(event.target.value as typeof period)}
                  >
                    {PERIODS.map((option) => (
                      <option key={option} value={option}>
                        {t(`periods.${option}`)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t('target')}>
                  <Input
                    type="number"
                    step="any"
                    min={0}
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                    className="text-center tabular-nums"
                  />
                </Field>
                <Field label={t('direction')}>
                  <Select
                    value={direction}
                    onChange={(event) => setDirection(event.target.value as typeof direction)}
                  >
                    {DIRECTIONS.map((option) => (
                      <option key={option} value={option}>
                        {t(`directions.${option}`)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <p className="text-xs text-accent">
                {t('metricPreview', {
                  aggregation: t(`aggregations.${aggregation}`),
                  metric: tm(metric),
                  period: t(`periods.${period}`),
                  target,
                })}
              </p>
            </div>
          ) : (
            <Field label={t('milestones')}>
              <Textarea
                name="milestones"
                rows={4}
                placeholder={t('milestoneHint')}
                defaultValue={goal?.milestones.map((milestone) => milestone.title).join('\n') ?? ''}
              />
            </Field>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            {goal ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await archiveGoal(goal.id)
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
