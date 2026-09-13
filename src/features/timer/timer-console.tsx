'use client'

import { Dumbbell, Loader2, Pause, Play, Square, Trash2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatDuration, TIMER_PRESETS_MINUTES } from '@/lib/timer'
import { cn } from '@/lib/utils'
import {
  discardTimer,
  pauseTimer,
  resumeTimer,
  startTimer,
  stopTimer,
} from '@/server/actions/timer'
import type { TimerPageData } from '@/server/services/timer'
import { chime, useElapsedSeconds, useNow, useWakeLock } from './use-run'

const FOCUS_KINDS = ['learning', 'deep_work', 'project'] as const

export function TimerConsole({ data }: { data: TimerPageData }) {
  const t = useTranslations('timer')
  const tc = useTranslations('common')
  const format = useFormatter()
  const [pending, startTransition] = useTransition()

  const timer = data.timer
  const running = timer !== null && timer.pausedAt === null
  const elapsed = useElapsedSeconds(timer)
  const now = useNow()
  useWakeLock(running)

  const countdown = timer?.mode === 'countdown' && timer.targetSeconds !== null
  const remaining = countdown ? (timer?.targetSeconds ?? 0) - elapsed : 0
  const done = countdown && remaining <= 0

  // Setup state, only meaningful while nothing is running.
  const [target, setTarget] = useState<'focus' | 'workout'>('focus')
  const [mode, setMode] = useState<'stopwatch' | 'countdown'>('stopwatch')
  const [minutes, setMinutes] = useState(25)
  const [kind, setKind] = useState<(typeof FOCUS_KINDS)[number]>('learning')
  const [topicId, setTopicId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [workoutType, setWorkoutType] = useState('')
  const [note, setNote] = useState('')

  const begin = () =>
    startTransition(async () => {
      const result = await startTimer({
        target,
        mode,
        targetMinutes: minutes,
        kind,
        topicId: topicId || null,
        projectId: projectId || null,
        workoutType: workoutType || null,
        note: note || null,
      })
      if (!result.ok) toast.error(tc('error'))
    })

  const toggle = () =>
    startTransition(async () => {
      await (running ? pauseTimer() : resumeTimer())
    })

  const finish = () =>
    startTransition(async () => {
      const result = await stopTimer({})
      if (!result.ok) {
        toast[result.error === 'too_short' ? 'info' : 'error'](
          result.error === 'too_short' ? t('tooShort') : tc('error'),
        )
        return
      }
      toast.success(
        result.target === 'workout'
          ? t('savedWorkout', { minutes: result.minutes })
          : t('savedSession', { minutes: result.minutes }),
      )
      if (result.capped) toast.warning(t('capped'), { duration: 8000 })
      setNote('')
    })

  const drop = () => startTransition(async () => void (await discardTimer()))

  useChime(done)
  useTabTitle(timer ? formatDuration(countdown ? remaining : elapsed) : null)
  useSpacebar(timer ? toggle : begin, pending)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card className="flex flex-col">
          <CardHeader title={t('clock')} />
          <CardBody className="flex flex-1 flex-col items-center justify-center gap-1 py-6">
            <p className="text-5xl font-semibold tabular-nums" suppressHydrationWarning>
              {now ? format.dateTime(now, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '--:--:--'}
            </p>
            <p className="text-sm text-text-muted" suppressHydrationWarning>
              {now ? format.dateTime(now, { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
            </p>
          </CardBody>
        </Card>

        <Card className={cn(done && 'border-accent')}>
          <CardHeader
            title={timer ? t(`targets.${timer.target}`) : t('newRun')}
            action={
              timer ? (
                <span
                  className={cn(
                    'flex items-center gap-1.5 text-xs font-medium',
                    running ? 'text-accent' : 'text-text-subtle',
                  )}
                >
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      running ? 'animate-pulse bg-accent' : 'bg-text-subtle',
                    )}
                  />
                  {t(running ? 'running' : 'paused')}
                </span>
              ) : null
            }
          />
          <CardBody>
            {timer ? (
              <div className="flex flex-col items-center gap-5 py-2">
                <Dial
                  label={formatDuration(countdown ? remaining : elapsed)}
                  progress={
                    countdown && timer.targetSeconds
                      ? Math.min(1, elapsed / timer.targetSeconds)
                      : null
                  }
                  muted={!running}
                  done={done}
                />

                <p className="text-center text-sm text-text-muted">
                  {describe(timer, data, t)}
                  {done ? <span className="ml-2 font-medium text-accent">{t('reached')}</span> : null}
                </p>

                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={toggle} disabled={pending} variant="outline" size="lg">
                    {running ? <Pause className="size-4" /> : <Play className="size-4" />}
                    {t(running ? 'pause' : 'resume')}
                  </Button>
                  <Button onClick={finish} disabled={pending} size="lg">
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Square className="size-4" />
                    )}
                    {t('stop')}
                  </Button>
                  <Button onClick={drop} disabled={pending} variant="ghost" size="lg">
                    <Trash2 className="size-4" />
                    {t('discard')}
                  </Button>
                </div>
                <p className="hidden text-xs text-text-subtle sm:block">{t('spaceHint')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <Segmented
                  options={[
                    { value: 'focus', label: t('targets.focus') },
                    { value: 'workout', label: t('targets.workout') },
                  ]}
                  value={target}
                  onChange={(value) => setTarget(value as typeof target)}
                />

                {target === 'focus' ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Labelled label={t('kind')}>
                      <Select
                        value={kind}
                        onChange={(event) => setKind(event.target.value as typeof kind)}
                      >
                        {FOCUS_KINDS.map((option) => (
                          <option key={option} value={option}>
                            {t(`kinds.${option}`)}
                          </option>
                        ))}
                      </Select>
                    </Labelled>
                    <Labelled label={t('topic')}>
                      <Select value={topicId} onChange={(event) => setTopicId(event.target.value)}>
                        <option value="">{tc('none')}</option>
                        {data.topics.map((topic) => (
                          <option key={topic.id} value={topic.id}>
                            {topic.name}
                          </option>
                        ))}
                      </Select>
                    </Labelled>
                    <Labelled label={t('project')}>
                      <Select
                        value={projectId}
                        onChange={(event) => setProjectId(event.target.value)}
                      >
                        <option value="">{tc('none')}</option>
                        {data.projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </Select>
                    </Labelled>
                  </div>
                ) : (
                  <Labelled label={t('workoutType')}>
                    <Input
                      value={workoutType}
                      onChange={(event) => setWorkoutType(event.target.value)}
                      placeholder={t('workoutPlaceholder')}
                      maxLength={80}
                    />
                    {data.workoutTypes.length > 0 ? (
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {data.workoutTypes.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setWorkoutType(type)}
                            className="rounded-full border border-border-base bg-surface-2 px-2.5 py-1 text-xs text-text-muted hover:text-text"
                          >
                            {type}
                          </button>
                        ))}
                      </span>
                    ) : null}
                  </Labelled>
                )}

                <Segmented
                  options={[
                    { value: 'stopwatch', label: t('modes.stopwatch') },
                    { value: 'countdown', label: t('modes.countdown') },
                  ]}
                  value={mode}
                  onChange={(value) => setMode(value as typeof mode)}
                />

                {mode === 'countdown' ? (
                  <span className="flex flex-wrap items-center gap-1.5">
                    {TIMER_PRESETS_MINUTES.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setMinutes(preset)}
                        aria-pressed={minutes === preset}
                        className={cn(
                          'rounded-full border px-3 py-1 text-sm',
                          minutes === preset
                            ? 'border-accent bg-accent-soft font-medium text-accent'
                            : 'border-border-base bg-surface-2 text-text-muted hover:text-text',
                        )}
                      >
                        {t('minutesShort', { minutes: preset })}
                      </button>
                    ))}
                    <Input
                      type="number"
                      min={1}
                      max={1440}
                      value={minutes}
                      onChange={(event) => setMinutes(Number(event.target.value) || 1)}
                      aria-label={t('customMinutes')}
                      className="h-9 w-24"
                    />
                  </span>
                ) : null}

                <Labelled label={t('note')}>
                  <Input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={200}
                    placeholder={t('notePlaceholder')}
                  />
                </Labelled>

                <div className="flex items-center gap-3 pt-1">
                  <Button onClick={begin} disabled={pending} size="lg" aria-label={t('start')}>
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    <span className="hidden sm:inline">{t('start')}</span>
                  </Button>
                  <span className="hidden text-xs text-text-subtle sm:inline">
                    {t('spaceHint')}
                  </span>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('todayTotals')} />
          <CardBody className="grid grid-cols-2 gap-2">
            <Total label={t('kinds.focus')} minutes={data.todayFocusMinutes} t={t} />
            <Total label={t('targets.workout')} minutes={data.todayWorkoutMinutes} t={t} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('recent')} />
          <CardBody>
            {data.recentSessions.length === 0 && data.recentWorkouts.length === 0 ? (
              <p className="text-sm text-text-subtle">{t('noRuns')}</p>
            ) : (
              <ul className="divide-y divide-border-base">
                {data.recentWorkouts.map((workout) => (
                  <li key={workout.id} className="flex items-center gap-3 py-2 text-sm">
                    <Dumbbell className="size-4 shrink-0 text-text-subtle" />
                    <span className="min-w-0 flex-1 truncate">{workout.type}</span>
                    <span className="shrink-0 text-xs tabular-nums text-text-subtle">
                      {workout.performedOn.slice(5)} · {t('minutesShort', { minutes: workout.durationMinutes })}
                    </span>
                  </li>
                ))}
                {data.recentSessions.map((session) => (
                  <li key={session.id} className="flex items-center gap-3 py-2 text-sm">
                    <Play className="size-4 shrink-0 text-text-subtle" />
                    <span className="min-w-0 flex-1 truncate">
                      {session.note ?? t(`kinds.${session.kind}`)}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-text-subtle">
                      {session.sessionDate.slice(5)} · {t('minutesShort', { minutes: session.minutes })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function Total({
  label,
  minutes,
  t,
}: {
  label: string
  minutes: number
  t: ReturnType<typeof useTranslations<'timer'>>
}) {
  return (
    <div className="rounded-[var(--radius)] border border-border-base bg-surface-2 px-3 py-2.5">
      <p className="truncate text-xs text-text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">
        {t('minutesShort', { minutes })}
      </p>
    </div>
  )
}

/** The big readout. A countdown also draws how much of the target is gone. */
function Dial({
  label,
  progress,
  muted,
  done,
}: {
  label: string
  progress: number | null
  muted: boolean
  done: boolean
}) {
  const radius = 86
  const circumference = 2 * Math.PI * radius

  return (
    <div className="relative flex size-52 items-center justify-center">
      {progress !== null ? (
        <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90">
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            strokeWidth="10"
            className="stroke-surface-2"
          />
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            className={cn('transition-[stroke-dashoffset] duration-1000 ease-linear', done ? 'stroke-good' : 'stroke-accent')}
          />
        </svg>
      ) : (
        <span className="absolute inset-0 rounded-full border-[10px] border-surface-2" />
      )}

      <span
        className={cn(
          'text-4xl font-semibold tabular-nums sm:text-5xl',
          muted && 'text-text-muted',
          done && 'text-good',
        )}
        role="timer"
        aria-live="off"
      >
        {label}
      </span>
    </div>
  )
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="inline-flex rounded-full border border-border-base bg-surface-2 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm transition-colors',
            value === option.value
              ? 'bg-surface font-medium text-text shadow-[var(--shadow-card)]'
              : 'text-text-muted hover:text-text',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      {children}
    </label>
  )
}

function describe(
  timer: NonNullable<TimerPageData['timer']>,
  data: TimerPageData,
  t: ReturnType<typeof useTranslations<'timer'>>,
): string {
  if (timer.target === 'workout') return timer.workoutType || t('targets.workout')

  const parts = [t(`kinds.${timer.kind}`)]
  const topic = data.topics.find((item) => item.id === timer.topicId)
  const project = data.projects.find((item) => item.id === timer.projectId)
  if (topic) parts.push(topic.name)
  if (project) parts.push(project.name)
  if (timer.note) parts.push(timer.note)
  return parts.join(' · ')
}

/** Rings once when a countdown reaches zero, not on every tick after. */
function useChime(done: boolean): void {
  const rung = useRef(false)

  useEffect(() => {
    if (!done) {
      rung.current = false
      return
    }
    if (rung.current) return
    rung.current = true
    chime()
  }, [done])
}

/** Puts the clock in the tab title, so another tab still shows the run. */
function useTabTitle(label: string | null): void {
  useEffect(() => {
    if (!label) return
    const original = document.title
    document.title = `${label} · ${original}`
    return () => {
      document.title = original
    }
  }, [label])
}

function useSpacebar(action: () => void, disabled: boolean): void {
  const latest = useRef(action)

  useEffect(() => {
    latest.current = action
  })

  useEffect(() => {
    if (disabled) return

    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || event.metaKey || event.ctrlKey) return
      const target = event.target as HTMLElement | null
      // Never steal the key from something the user is typing or pressing into.
      if (target?.closest('input, textarea, select, button, [contenteditable]')) return
      event.preventDefault()
      latest.current()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [disabled])
}
