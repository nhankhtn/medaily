'use client'

import { Check, Copy, Info, Loader2, Moon, Save, Trash2 } from 'lucide-react'
import { MarkdownField } from './markdown-field'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MinuteInput } from '@/components/ui/minute-input'
import { ScaleInput } from '@/components/ui/scale-input'
import { Stepper } from '@/components/ui/stepper'
import type { ISODate } from '@/lib/dates'
import type { LoggingStreak } from '@/lib/daily/trail'
import type { CustomMetric } from '@/lib/db/schema'
import type { EffectiveDailyLog } from '@/lib/types'
import { cn } from '@/lib/utils'
import { copyPreviousDay, deleteDay, saveDay, undoSaveDay } from '@/server/actions/daily'
import type { MetricMedians } from '@/server/repositories/daily'
import type { RunningTimer } from '@/server/services/timer'
import { useShortcut } from '@/features/shortcuts/provider'
import { useEffectiveTimer } from '@/features/timer/use-effective-timer'
import { confettiFrom, haptic, isMilestone, rippleFrom } from './celebrate'
import { DayBudget } from './day-budget'
import { announceDayLogged, peekDayDirection, setDayDirection } from './day-events'
import { DayProgress } from './day-progress'
import { LiveTimer, liveFieldOf } from './live-timer'
import { CustomFields, type CustomValues } from './custom-fields'
import { Field, FormSection } from './section'
import { queuePendingSave } from './pending-saves'
import { useDraft, useUnsavedGuard } from './use-draft'
import { fieldIsHidden, visibleFields, type HideableField } from '@/lib/daily/hidden-fields'
import {
  ACTIVITY_FIELDS,
  countFilled,
  ESSENTIAL_FIELDS,
  REFLECTION_FIELDS,
  toPatch,
  type DailyFormValues,
} from './types'

/** How long Undo stays on the toast (spec 6.3). */
const UNDO_MS = 5000

/** Sections rise in on the first visit only; changing day slides instead. */
let entered = false

/** Every field in the order it is drawn, so a copy fills them top to bottom. */
const FIELD_ORDER: readonly (keyof DailyFormValues)[] = [
  ...ESSENTIAL_FIELDS,
  ...ACTIVITY_FIELDS,
  ...REFLECTION_FIELDS,
]

export function DailyForm({
  date,
  initialValues,
  effective,
  medians,
  exerciseTypes,
  existed,
  customMetrics,
  initialCustom,
  hiddenFields,
  today,
  streak,
  timer,
}: {
  date: ISODate
  initialValues: DailyFormValues
  effective: EffectiveDailyLog | null
  medians: MetricMedians
  exerciseTypes: string[]
  existed: boolean
  customMetrics: CustomMetric[]
  initialCustom: CustomValues
  hiddenFields: readonly string[]
  today: ISODate
  streak: LoggingStreak
  timer: RunningTimer | null
}) {
  const t = useTranslations('daily')
  const tc = useTranslations('common')
  const [values, setValues] = useState<DailyFormValues>(initialValues)
  const [copied, setCopied] = useState<Set<keyof DailyFormValues>>(new Set())
  const [pending, startTransition] = useTransition()
  const [custom, setCustom] = useState<CustomValues>(initialCustom)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [justSaved, setJustSaved] = useState(0)
  const saveButton = useRef<HTMLButtonElement>(null)
  // Whether this day exists on the server right now, as far as this form knows.
  const logged = useRef(existed)

  const [entrance] = useState(() => {
    const direction = peekDayDirection()
    if (direction !== 0) return direction > 0 ? 'daily-slide-next' : 'daily-slide-prev'
    return entered ? null : 'first'
  })
  useEffect(() => {
    entered = true
    setDayDirection(0)
  }, [])

  // Always the real run: passing null here would clear a mirror that is still going.
  const run = useEffectiveTimer(timer)
  const liveField = date === today ? liveFieldOf(run) : null
  const live = (field: keyof DailyFormValues) =>
    run && liveField === field ? <LiveTimer timer={run} /> : undefined

  useEffect(() => {
    if (!justSaved) return
    const id = window.setTimeout(() => setJustSaved(0), 1600)
    return () => window.clearTimeout(id)
  }, [justSaved])
  const {
    restored,
    save: saveDraft,
    clear: clearDraft,
  } = useDraft(date, initialValues, initialCustom)

  // The parent remounts this form per date (`key={date}`), so `initialValues`
  // is genuinely initial — no effect is needed to resynchronise it.
  useEffect(() => {
    if (!restored) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a device-local draft
    setValues(restored.values)
    setCustom(restored.custom)
    toast.info(t('unsavedDraft'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored])

  const dirty = useMemo(
    () =>
      JSON.stringify(values) !== JSON.stringify(initialValues) ||
      JSON.stringify(custom) !== JSON.stringify(initialCustom),
    [values, initialValues, custom, initialCustom],
  )
  useUnsavedGuard(dirty, t('unsavedWarning'))

  // One writer for both halves. Saving from inside each handler meant every
  // handler needed the *other* half as well, and read it from a closure that
  // was one keystroke out of date — so a custom field and a built-in field
  // took turns overwriting each other in storage.
  useEffect(() => {
    if (!dirty) return
    saveDraft(values, custom)
  }, [dirty, values, custom, saveDraft])

  const set = useCallback(
    <K extends keyof DailyFormValues>(key: K, value: DailyFormValues[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }))
      setCopied((prev) => {
        if (!prev.has(key)) return prev
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    },
    [],
  )

  const markLogged = useCallback(
    (next: boolean) => {
      logged.current = next
      announceDayLogged(date, next)
    },
    [date],
  )

  /** The save landed: button settles, ripple, and confetti on a streak milestone. */
  const celebrate = useCallback(() => {
    const firstOfToday = date === today && !logged.current && streak.pendingToday
    markLogged(true)
    setJustSaved((n) => n + 1)
    haptic()
    const button = saveButton.current
    if (!button) return
    if (firstOfToday && isMilestone(streak.current + 1)) confettiFrom(button)
    else rippleFrom(button)
  }, [date, today, streak, markLogged])

  const submit = useCallback(() => {
    startTransition(async () => {
      const patch = toPatch(values)

      let result: Awaited<ReturnType<typeof saveDay>>
      try {
        result = await saveDay({ date, patch, source: 'manual', custom })
      } catch {
        // The action throws when it cannot reach the server, which is the one
        // failure worth keeping: the day is held on the device and goes up on
        // its own once there is a network. Safe to replay — the write upserts
        // on (user_id, log_date).
        try {
          await queuePendingSave({ date, patch, custom })
        } catch (error) {
          // The device would not hold it either. Say so and keep the draft —
          // reporting a save that happened nowhere is worse than an error,
          // because nothing then tells them the day is gone.
          console.error('[offline] could not keep the day on this device:', error)
          toast.error(t('offline.notKept'))
          return
        }

        clearDraft()
        setSavedAt(Date.now())
        setJustSaved((n) => n + 1)
        haptic()
        toast.success(t('offline.queued'))
        return
      }

      if (!result.ok) {
        toast.error(result.error === 'future_date' ? t('futureBlocked') : tc('error'))
        return
      }

      clearDraft()
      setSavedAt(Date.now())
      celebrate()

      toast.success(t('savedToast'), {
        duration: UNDO_MS,
        description: (
          <span aria-hidden className="bg-surface-2 mt-1 block h-0.5 overflow-hidden rounded-full">
            <span
              className="daily-countdown bg-current block h-full opacity-60"
              style={{ '--duration': `${UNDO_MS}ms` } as React.CSSProperties}
            />
          </span>
        ),
        action: {
          label: tc('undo'),
          onClick: () => {
            void undoSaveDay({ date, previous: result.previous }).then(() => {
              setValues(
                result.previous
                  ? ({ ...values, ...result.previous } as DailyFormValues)
                  : initialValues,
              )
              if (!result.previous) markLogged(false)
            })
          },
        },
      })

      if (result.warning === 'day_budget') {
        toast.warning(t('sanityWarning'), { duration: 8000 })
      }
    })
    // `custom` belongs here: left out, the callback kept the empty object it
    // closed over on the first render and every save posted `custom: {}`,
    // however many of your own activities you had filled in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, values, custom, initialValues, clearDraft, celebrate, markLogged])

  useShortcut('save', submit)

  // ⌘S is not in the registry: it is here to stop the browser's own save
  // dialog, whatever the user has bound the app's save key to.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // `key` can be missing on a keydown an extension dispatched; this is a
      // window listener, so reading it blindly would take the page down.
      if (typeof event.key !== 'string') return
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return
      event.preventDefault()
      submit()
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
        saveDraft(next, custom)
        return next
      })
      setCopied(filled)
      haptic(8)
      toast.success(t('copiedFromYesterday', { date: previous.date }))
    })
  }

  const removeDay = () => {
    startTransition(async () => {
      await deleteDay(date)
      setValues({ ...initialValues })
      clearDraft()
      markLogged(false)
      toast.success(t('deletedToast'))
    })
  }

  const copyOrder = FIELD_ORDER.filter((field) => copied.has(field))
  const copyIndex = (field: keyof DailyFormValues) => Math.max(0, copyOrder.indexOf(field))
  // Per kind: a deep-work session must not make the study field claim sessions.
  const studyFromSessions = (effective?.learningSessionCount ?? 0) > 0
  const deepWorkFromSessions = (effective?.executionSessionCount ?? 0) > 0

  /*
   * A field turned off in settings still appears on a day that has a value in
   * it — the timer fills six of these without anyone typing, and a number you
   * cannot see is a number you cannot correct. So the section counts are of
   * what is on screen, not of what exists.
   */
  const off = (field: HideableField) => fieldIsHidden(field, hiddenFields, values)
  const essentials = visibleFields(ESSENTIAL_FIELDS, hiddenFields, values)
  const activity = visibleFields(ACTIVITY_FIELDS, hiddenFields, values)
  const reflection = visibleFields(REFLECTION_FIELDS, hiddenFields, values)

  const essentialsFilled = countFilled(values, essentials)
  const activityFilled = countFilled(values, activity)
  const reflectionFilled = countFilled(values, reflection)

  const rise = (i: number) =>
    entrance === 'first'
      ? { className: 'daily-rise', style: { '--i': i } as React.CSSProperties }
      : {}

  return (
    <div className="pb-36 md:pb-4">
      <div
        data-daily-swipe
        className={cn('space-y-4', entrance && entrance !== 'first' && entrance)}
      >
      <div className="flex flex-wrap items-center gap-2" {...rise(0)}>
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
          <span key={savedAt} className="daily-pop text-good inline-block text-xs">
            {tc('saved')}
          </span>
        ) : dirty ? (
          <span className="text-text-subtle text-xs">•</span>
        ) : null}
      </div>

      <div data-tour="daily-essentials" {...rise(1)}>
        <FormSection
          title={t('sections.essentials')}
          filled={essentialsFilled}
          total={essentials.length}
        >
          <Field
            label={t('fields.energy')}
            help={t('fields.energyHelp')}
            copied={copied.has('energy')}
            copyIndex={copyIndex('energy')}
            off={off('energy')}
          >
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
            copyIndex={copyIndex('sleepHours')}
            off={off('sleepHours')}
          >
            <Stepper
              name={t('fields.sleepHours')}
              value={values.sleepHours}
              onChange={(value) => set('sleepHours', value)}
              suffix={tc('hoursShort')}
              adornment={<SleepMoon hours={values.sleepHours} />}
            />
          </Field>

          <Field
            label={t('fields.technicalStudy')}
            hint={
              studyFromSessions
                ? t('sessionsDerived', {
                    minutes: effective?.effectiveStudyMinutes ?? 0,
                    count: effective?.learningSessionCount ?? 0,
                  })
                : medians.technicalStudyMinutes
                  ? t('medianHint', { value: medians.technicalStudyMinutes })
                  : undefined
            }
            help={t('fields.technicalStudyHelp')}
            copied={copied.has('technicalStudyMinutes')}
            copyIndex={copyIndex('technicalStudyMinutes')}
            badge={live('technicalStudyMinutes')}
            off={off('technicalStudyMinutes')}
          >
            <MinuteInput
              name={t('fields.technicalStudy')}
              value={values.technicalStudyMinutes}
              medianHint={medians.technicalStudyMinutes}
              derived={studyFromSessions ? effective?.effectiveStudyMinutes : null}
              onChange={(value) => set('technicalStudyMinutes', value)}
            />
          </Field>

          <Field
            label={t('fields.deepWork')}
            hint={
              deepWorkFromSessions
                ? t('sessionsDerived', {
                    minutes: effective?.effectiveDeepWorkMinutes ?? 0,
                    count: effective?.executionSessionCount ?? 0,
                  })
                : medians.deepWorkMinutes
                  ? t('medianHint', { value: medians.deepWorkMinutes })
                  : undefined
            }
            help={t('fields.deepWorkHelp')}
            copied={copied.has('deepWorkMinutes')}
            copyIndex={copyIndex('deepWorkMinutes')}
            badge={live('deepWorkMinutes')}
            off={off('deepWorkMinutes')}
          >
            <MinuteInput
              name={t('fields.deepWork')}
              value={values.deepWorkMinutes}
              medianHint={medians.deepWorkMinutes}
              derived={deepWorkFromSessions ? effective?.effectiveDeepWorkMinutes : null}
              onChange={(value) => set('deepWorkMinutes', value)}
            />
          </Field>

          {/* Only worth saying once both fields are in play — that is when
            double-counting becomes possible. */}
          {(values.technicalStudyMinutes ?? 0) > 0 && (values.deepWorkMinutes ?? 0) > 0 ? (
            <p className="bg-surface-2 text-text-muted flex items-start gap-2 rounded-[var(--radius)] p-2.5 text-xs leading-snug">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {t('disjointHint')}
            </p>
          ) : null}
        </FormSection>
      </div>

      <div {...rise(2)}>
      <FormSection
        title={t('sections.activity')}
        filled={activityFilled}
        total={activity.length}
        defaultOpen={false}
      >
        <Field
          label={t('fields.exercise')}
          copied={copied.has('exerciseMinutes')}
            copyIndex={copyIndex('exerciseMinutes')}
            badge={live('exerciseMinutes')}
          off={off('exerciseMinutes')}
        >
          <div className="space-y-2">
            <MinuteInput
              name={t('fields.exercise')}
              value={values.exerciseMinutes}
              presets={[20, 30, 45, 60, 90]}
              medianHint={medians.exerciseMinutes}
              onChange={(value) => set('exerciseMinutes', value)}
            />
            <div className="daily-drawer" data-open={(values.exerciseMinutes ?? 0) > 0}>
              <div
                className="space-y-2"
                inert={(values.exerciseMinutes ?? 0) === 0}
              >
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
                            ? 'bg-accent text-accent-text border-transparent'
                            : 'glass text-text-muted',
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Field>

        <Field
          label={t('fields.reading')}
          copied={copied.has('readingMinutes')}
            copyIndex={copyIndex('readingMinutes')}
            badge={live('readingMinutes')}
          off={off('readingMinutes')}
        >
          <div className="space-y-2">
            <MinuteInput
              name={t('fields.reading')}
              value={values.readingMinutes}
              presets={[10, 15, 20, 30, 45, 60]}
              medianHint={medians.readingMinutes}
              onChange={(value) => set('readingMinutes', value)}
            />
            <div className="flex items-center gap-2">
              <span className="text-text-subtle text-xs">{t('fields.readingPages')}</span>
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
            copyIndex={copyIndex('entertainmentMinutes')}
            badge={live('entertainmentMinutes')}
          off={off('entertainmentMinutes')}
        >
          <MinuteInput
            name={t('fields.entertainment')}
            value={values.entertainmentMinutes}
            medianHint={medians.entertainmentMinutes}
            onChange={(value) => set('entertainmentMinutes', value)}
          />
        </Field>

        <Field
          label={t('fields.english')}
          copied={copied.has('englishMinutes')}
            copyIndex={copyIndex('englishMinutes')}
            badge={live('englishMinutes')}
          off={off('englishMinutes')}
        >
          <MinuteInput
            name={t('fields.english')}
            value={values.englishMinutes}
            presets={[10, 15, 20, 30, 45]}
            medianHint={medians.englishMinutes}
            onChange={(value) => set('englishMinutes', value)}
          />
        </Field>

        <Field label={t('fields.mood')} copied={copied.has('mood')}
            copyIndex={copyIndex('mood')} off={off('mood')}>
          <ScaleInput
            name={t('fields.mood')}
            tone="good"
            value={values.mood}
            onChange={(value) => set('mood', value)}
          />
        </Field>
      </FormSection>
      </div>

      <CustomFields
        metrics={customMetrics}
        values={custom}
        onChange={(id, value) => setCustom((prev) => ({ ...prev, [id]: value }))}
      />

      <div {...rise(3)}>
      <FormSection
        title={t('sections.reflection')}
        filled={reflectionFilled}
        total={reflection.length}
        defaultOpen={false}
      >
        <MarkdownField
          label={t('fields.dailyWin')}
          copied={copied.has('dailyWin')}
            copyIndex={copyIndex('dailyWin')}
          off={off('dailyWin')}
          className="min-h-16"
          value={values.dailyWin}
          placeholder={t('fields.dailyWinPlaceholder')}
          onChange={(value) => set('dailyWin', value)}
        />
        <MarkdownField
          label={t('fields.dailyProblem')}
          copied={copied.has('dailyProblem')}
            copyIndex={copyIndex('dailyProblem')}
          off={off('dailyProblem')}
          className="min-h-16"
          value={values.dailyProblem}
          placeholder={t('fields.dailyProblemPlaceholder')}
          onChange={(value) => set('dailyProblem', value)}
        />
        <MarkdownField
          label={t('fields.tomorrowPriority')}
          copied={copied.has('tomorrowPriority')}
            copyIndex={copyIndex('tomorrowPriority')}
          off={off('tomorrowPriority')}
          className="min-h-16"
          value={values.tomorrowPriority}
          placeholder={t('fields.tomorrowPriorityPlaceholder')}
          onChange={(value) => set('tomorrowPriority', value)}
        />
        <MarkdownField
          label={t('fields.note')}
          copied={copied.has('note')}
            copyIndex={copyIndex('note')}
          off={off('note')}
          value={values.note}
          placeholder={t('fields.notePlaceholder')}
          onChange={(value) => set('note', value)}
        />
      </FormSection>
      </div>

      <DayBudget values={values} />
      </div>

      {/* Outside the animated wrapper: a transform there would carry this fixed footer with it. */}
      <div className="glass-chip fixed right-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] left-3 z-20 space-y-2.5 rounded-[1.5rem] p-3 md:static md:inset-auto md:z-auto md:mt-4 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
        <DayProgress
          filled={essentialsFilled + activityFilled + reflectionFilled}
          total={essentials.length + activity.length + reflection.length}
          essentialsDone={essentials.length > 0 && essentialsFilled === essentials.length}
        />
        <Button
          ref={saveButton}
          size="lg"
          className={cn('w-full md:w-auto', justSaved > 0 && 'bg-good hover:bg-good')}
          onClick={submit}
          disabled={pending}
        >
          {/* Keyed on the inside, so the replayed animation never costs the button its focus. */}
          <span
            key={justSaved}
            className={cn('inline-flex items-center gap-2', justSaved > 0 && 'daily-save-done')}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : justSaved ? (
              <Check className="daily-pop size-4" />
            ) : (
              <Save className="size-4" />
            )}
            {pending ? tc('saving') : justSaved ? tc('saved') : t('saveDay')}
          </span>
        </Button>
      </div>
    </div>
  )
}

/** Droops under six hours, glows from seven to nine. */
function SleepMoon({ hours }: { hours: number | null }) {
  const rested = hours !== null && hours >= 7 && hours <= 9
  const short = hours !== null && hours < 6
  return (
    <Moon
      aria-hidden
      className={cn(
        'size-4 transition-[transform,color,opacity] duration-500',
        rested && 'text-accent fill-accent/30 drop-shadow-[0_0_6px_var(--accent)]',
        short && 'text-text-subtle translate-y-0.5 rotate-[-35deg] opacity-60',
        !rested && !short && 'text-text-subtle',
      )}
    />
  )
}
