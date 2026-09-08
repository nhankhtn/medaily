'use client'

import { AlertTriangle, Copy, Info, Loader2, Save, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { MinuteInput } from '@/components/ui/minute-input'
import { ScaleInput } from '@/components/ui/scale-input'
import { Stepper } from '@/components/ui/stepper'
import type { ISODate } from '@/lib/dates'
import type { EffectiveDailyLog } from '@/lib/types'
import { cn } from '@/lib/utils'
import { copyPreviousDay, deleteDay, saveDay, undoSaveDay } from '@/server/actions/daily'
import type { MetricMedians } from '@/server/repositories/daily'
import { Field, FormSection } from './section'
import { useDraft, useUnsavedGuard } from './use-draft'
import {
  ACTIVITY_FIELDS,
  countFilled,
  ESSENTIAL_FIELDS,
  REFLECTION_FIELDS,
  toPatch,
  trackedHours,
  type DailyFormValues,
} from './types'

export function DailyForm({
  date,
  initialValues,
  effective,
  medians,
  exerciseTypes,
  existed,
}: {
  date: ISODate
  initialValues: DailyFormValues
  effective: EffectiveDailyLog | null
  medians: MetricMedians
  exerciseTypes: string[]
  existed: boolean
}) {
  const t = useTranslations('daily')
  const tc = useTranslations('common')
  const [values, setValues] = useState<DailyFormValues>(initialValues)
  const [copied, setCopied] = useState<Set<keyof DailyFormValues>>(new Set())
  const [pending, startTransition] = useTransition()
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const { restored, save: saveDraft, clear: clearDraft } = useDraft(date, initialValues)

  // The parent remounts this form per date (`key={date}`), so `initialValues`
  // is genuinely initial — no effect is needed to resynchronise it.
  useEffect(() => {
    if (!restored) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a device-local draft
    setValues(restored)
    toast.info(t('unsavedDraft'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored])

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialValues),
    [values, initialValues],
  )
  useUnsavedGuard(dirty, t('unsavedWarning'))

  const set = useCallback(
    <K extends keyof DailyFormValues>(key: K, value: DailyFormValues[K]) => {
      setValues((prev) => {
        const next = { ...prev, [key]: value }
        saveDraft(next)
        return next
      })
      setCopied((prev) => {
        if (!prev.has(key)) return prev
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    },
    [saveDraft],
  )

  const submit = useCallback(() => {
    startTransition(async () => {
      const result = await saveDay({ date, patch: toPatch(values), source: 'manual' })

      if (!result.ok) {
        toast.error(result.error === 'future_date' ? t('futureBlocked') : tc('error'))
        return
      }

      clearDraft()
      setSavedAt(Date.now())

      toast.success(t('savedToast'), {
        action: {
          label: tc('undo'),
          onClick: () => {
            void undoSaveDay({ date, previous: result.previous }).then(() => {
              setValues(
                result.previous
                  ? ({ ...values, ...result.previous } as DailyFormValues)
                  : initialValues,
              )
            })
          },
        },
      })

      if (result.warning === 'day_budget') {
        toast.warning(t('sanityWarning'), { duration: 8000 })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, values, initialValues, clearDraft])

  // `s` saves from anywhere outside a text field (spec 22.2).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const inField = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        submit()
        return
      }
      if (!inField && event.key === 's' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault()
        submit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [submit])

  const fillFromPrevious = () => {
    startTransition(async () => {
      const previous = await copyPreviousDay(date)
      if (!previous) {
        toast.info(t('noPreviousDay'))
        return
      }
      const filled = new Set<keyof DailyFormValues>()
      setValues((prev) => {
        const next = { ...prev }
        for (const [key, value] of Object.entries(previous.patch)) {
          if (value === undefined) continue
          const field = key as keyof DailyFormValues
          // Never overwrite something the user already typed.
          if (next[field] !== null && next[field] !== '') continue
          Object.assign(next, { [field]: value })
          if (value !== null) filled.add(field)
        }
        saveDraft(next)
        return next
      })
      setCopied(filled)
      toast.success(t('copiedFromYesterday', { date: previous.date }))
    })
  }

  const removeDay = () => {
    startTransition(async () => {
      await deleteDay(date)
      setValues({ ...initialValues })
      clearDraft()
      toast.success(t('deletedToast'))
    })
  }

  const hours = trackedHours(values)
  const overBudget = hours > 20
  const sessionsDerived = (effective?.sessionCount ?? 0) > 0

  const essentialsFilled = countFilled(values, ESSENTIAL_FIELDS)
  const activityFilled = countFilled(values, ACTIVITY_FIELDS)
  const reflectionFilled = countFilled(values, REFLECTION_FIELDS)

  return (
    <div className="space-y-4 pb-28 md:pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={fillFromPrevious} disabled={pending}>
          <Copy className="size-4" />
          {t('copyYesterday')}
        </Button>
        {existed ? (
          <Button variant="ghost" size="sm" onClick={removeDay} disabled={pending}>
            <Trash2 className="size-4" />
            {tc('delete')}
          </Button>
        ) : null}
        {savedAt && !dirty ? (
          <span className="text-xs text-good">{tc('saved')}</span>
        ) : dirty ? (
          <span className="text-xs text-text-subtle">•</span>
        ) : null}
      </div>

      <FormSection
        title={t('sections.essentials')}
        filled={essentialsFilled}
        total={ESSENTIAL_FIELDS.length}
      >
        <Field label={t('fields.energy')} help={t('fields.energyHelp')} copied={copied.has('energy')}>
          <ScaleInput
            name={t('fields.energy')}
            value={values.energy}
            onChange={(value) => set('energy', value)}
          />
        </Field>

        <Field
          label={t('fields.sleepHours')}
          hint={medians.sleepHours ? t('medianHint', { value: medians.sleepHours }) : undefined}
          help={t('fields.sleepHelp')}
          copied={copied.has('sleepHours')}
        >
          <Stepper
            name={t('fields.sleepHours')}
            value={values.sleepHours}
            onChange={(value) => set('sleepHours', value)}
            suffix={tc('hoursShort')}
          />
        </Field>

        <Field
          label={t('fields.technicalStudy')}
          hint={
            sessionsDerived
              ? t('sessionsDerived', {
                  minutes: effective?.effectiveStudyMinutes ?? 0,
                  count: effective?.sessionCount ?? 0,
                })
              : medians.technicalStudyMinutes
                ? t('medianHint', { value: medians.technicalStudyMinutes })
                : undefined
          }
          help={t('fields.technicalStudyHelp')}
          copied={copied.has('technicalStudyMinutes')}
        >
          <MinuteInput
            name={t('fields.technicalStudy')}
            value={values.technicalStudyMinutes}
            medianHint={medians.technicalStudyMinutes}
            onChange={(value) => set('technicalStudyMinutes', value)}
          />
        </Field>

        <Field
          label={t('fields.deepWork')}
          hint={
            medians.deepWorkMinutes ? t('medianHint', { value: medians.deepWorkMinutes }) : undefined
          }
          help={t('fields.deepWorkHelp')}
          copied={copied.has('deepWorkMinutes')}
        >
          <MinuteInput
            name={t('fields.deepWork')}
            value={values.deepWorkMinutes}
            medianHint={medians.deepWorkMinutes}
            onChange={(value) => set('deepWorkMinutes', value)}
          />
        </Field>

        {/* Only worth saying once both fields are in play — that is when
            double-counting becomes possible. */}
        {(values.technicalStudyMinutes ?? 0) > 0 && (values.deepWorkMinutes ?? 0) > 0 ? (
          <p className="flex items-start gap-2 rounded-[var(--radius)] bg-surface-2 p-2.5 text-xs leading-snug text-text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            {t('disjointHint')}
          </p>
        ) : null}
      </FormSection>

      <FormSection
        title={t('sections.activity')}
        filled={activityFilled}
        total={ACTIVITY_FIELDS.length}
        defaultOpen={false}
      >
        <Field label={t('fields.exercise')} copied={copied.has('exerciseMinutes')}>
          <div className="space-y-2">
            <MinuteInput
              name={t('fields.exercise')}
              value={values.exerciseMinutes}
              presets={[20, 30, 45, 60, 90]}
              medianHint={medians.exerciseMinutes}
              onChange={(value) => set('exerciseMinutes', value)}
            />
            {(values.exerciseMinutes ?? 0) > 0 ? (
              <div className="space-y-2">
                <Input
                  value={values.exerciseType ?? ''}
                  placeholder={t('fields.exerciseTypePlaceholder')}
                  aria-label={t('fields.exerciseType')}
                  onChange={(event) => set('exerciseType', event.target.value || null)}
                />
                {exerciseTypes.length ? (
                  <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                    {exerciseTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => set('exerciseType', type)}
                        className={cn(
                          'h-8 shrink-0 rounded-full border px-3 text-xs',
                          values.exerciseType === type
                            ? 'border-transparent bg-accent text-accent-text'
                            : 'border-border-base bg-surface-2 text-text-muted',
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Field>

        <Field label={t('fields.reading')} copied={copied.has('readingMinutes')}>
          <div className="space-y-2">
            <MinuteInput
              name={t('fields.reading')}
              value={values.readingMinutes}
              presets={[10, 15, 20, 30, 45, 60]}
              medianHint={medians.readingMinutes}
              onChange={(value) => set('readingMinutes', value)}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-subtle">{t('fields.readingPages')}</span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={10000}
                className="h-9 w-24 text-center tabular-nums"
                value={values.readingPages ?? ''}
                aria-label={t('fields.readingPages')}
                onChange={(event) =>
                  set('readingPages', event.target.value === '' ? null : Number(event.target.value))
                }
              />
            </div>
          </div>
        </Field>

        <Field
          label={t('fields.entertainment')}
          help={t('fields.entertainmentHelp')}
          copied={copied.has('entertainmentMinutes')}
        >
          <MinuteInput
            name={t('fields.entertainment')}
            value={values.entertainmentMinutes}
            medianHint={medians.entertainmentMinutes}
            onChange={(value) => set('entertainmentMinutes', value)}
          />
        </Field>

        <Field label={t('fields.english')} copied={copied.has('englishMinutes')}>
          <MinuteInput
            name={t('fields.english')}
            value={values.englishMinutes}
            presets={[10, 15, 20, 30, 45]}
            medianHint={medians.englishMinutes}
            onChange={(value) => set('englishMinutes', value)}
          />
        </Field>

        <Field label={t('fields.mood')} copied={copied.has('mood')}>
          <ScaleInput
            name={t('fields.mood')}
            tone="good"
            value={values.mood}
            onChange={(value) => set('mood', value)}
          />
        </Field>
      </FormSection>

      <FormSection
        title={t('sections.reflection')}
        filled={reflectionFilled}
        total={REFLECTION_FIELDS.length}
        defaultOpen={false}
      >
        <Field label={t('fields.dailyWin')} copied={copied.has('dailyWin')}>
          <Textarea
            className="min-h-16"
            value={values.dailyWin ?? ''}
            placeholder={t('fields.dailyWinPlaceholder')}
            onChange={(event) => set('dailyWin', event.target.value || null)}
          />
        </Field>
        <Field label={t('fields.dailyProblem')} copied={copied.has('dailyProblem')}>
          <Textarea
            className="min-h-16"
            value={values.dailyProblem ?? ''}
            placeholder={t('fields.dailyProblemPlaceholder')}
            onChange={(event) => set('dailyProblem', event.target.value || null)}
          />
        </Field>
        <Field label={t('fields.tomorrowPriority')} copied={copied.has('tomorrowPriority')}>
          <Textarea
            className="min-h-16"
            value={values.tomorrowPriority ?? ''}
            placeholder={t('fields.tomorrowPriorityPlaceholder')}
            onChange={(event) => set('tomorrowPriority', event.target.value || null)}
          />
        </Field>
        <Field label={t('fields.note')} copied={copied.has('note')}>
          <Textarea
            value={values.note ?? ''}
            placeholder={t('fields.notePlaceholder')}
            onChange={(event) => set('note', event.target.value || null)}
          />
        </Field>
      </FormSection>

      {overBudget ? (
        <p className="flex items-start gap-2 rounded-[var(--radius)] bg-warn-soft p-3 text-sm text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {t('sanityWarning')}
        </p>
      ) : null}

      {/* Sticky on mobile so Save is always in thumb reach (spec 22.3) */}
      <div className="fixed inset-x-0 bottom-14 z-20 border-t border-border-base bg-surface/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <Button size="lg" className="w-full md:w-auto" onClick={submit} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {pending ? tc('saving') : t('saveDay')}
        </Button>
      </div>
    </div>
  )
}
