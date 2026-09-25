'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { timerFilings } from '@/lib/db/schema'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { logicalDateOf } from '@/lib/dates'
import { PATHS } from '@/lib/paths'
import { elapsedSeconds, minutesOf, pausedRun, resumedRun, tooShort, wasCapped } from '@/lib/timer'
import { activityOf, isActivityId, type ActivityId } from '@/lib/timer/activities'
import { saveWorkout } from '@/server/actions/health'
import { findCustomMetric } from '@/server/repositories/custom-metrics'
import {
  clearTimer,
  findTimer,
  startTimer as persistTimer,
  updateTimer,
} from '@/server/repositories/timer'
import { addCustomMinutes, addDailyMinutes } from '@/server/services/daily-minutes'
import { saveSessionAndDerive } from '@/server/services/focus'
import { dayContextOf, getSettings } from '@/server/services/settings'

const optionalId = z.string().uuid().nullable().optional()
const optionalText = z
  .string()
  .max(2000)
  .transform((value) => (value.trim() === '' ? null : value.trim()))
  .nullable()
  .optional()

function revalidateTimer(date?: string) {
  revalidatePath(PATHS.timer)
  revalidatePath(PATHS.learning)
  revalidatePath(PATHS.health)
  revalidatePath(PATHS.home)
  revalidatePath(PATHS.daily)
  if (date) revalidatePath(PATHS.dailyOn(date))
}

const startSchema = z.object({
  activity: z.custom<ActivityId>(isActivityId).default('learning'),
  mode: z.enum(['stopwatch', 'countdown']).default('stopwatch'),
  targetMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  workoutType: z.string().max(80).nullable().optional(),
  topicId: optionalId,
  projectId: optionalId,
  note: optionalText,
})

type FiledRun = {
  minutes: number
  activity: ActivityId
  sink: ReturnType<typeof activityOf>['sink']
  capped: boolean
  date: string
}

/**
 * Files whatever run the server is holding, and clears it.
 *
 * Running or paused makes no difference: `elapsedSeconds` already counts a
 * paused run's accumulated time, so both are filed for what they actually ran.
 */
async function fileHeldRun(
  settings: Awaited<ReturnType<typeof getSettings>>,
  overrides?: { note?: string | null; rpe?: number | null },
): Promise<FiledRun | 'not_running' | 'too_short'> {
  const timer = await findTimer(settings.userId)
  if (!timer) return 'not_running'

  const seconds = elapsedSeconds(timer)
  if (tooShort(seconds)) {
    await clearTimer(settings.userId)
    return 'too_short'
  }

  const minutes = minutesOf(seconds)
  const date = logicalDateOf(timer.startedAt, dayContextOf(settings))
  // A run started by the previous release has no activity; its `kind` says it.
  const activity = activityOf(isActivityId(timer.activity) ? timer.activity : timer.kind)

  await fileToSink({
    userId: settings.userId,
    weekStart: settings.weekStart,
    activity,
    date,
    minutes,
    startedAt: timer.startedAt,
    endedAt: new Date(),
    workoutType: timer.workoutType,
    topicId: timer.topicId,
    projectId: timer.projectId,
    note: overrides?.note ?? timer.note,
    rpe: overrides?.rpe ?? null,
  })

  await clearTimer(settings.userId)
  return { minutes, activity: activity.id, sink: activity.sink, capped: wasCapped(seconds), date }
}

export async function startTimer(input: unknown) {
  const parsed = startSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const { activity: id, mode, targetMinutes, workoutType, topicId, projectId, note } = parsed.data
  const activity = activityOf(id)
  const isFocus = activity.sink === 'focus'
  const settings = await getSettings()
  const userId = settings.userId

  // Refuse an activity pointing at a metric that is gone: the run would count
  // an hour and then have nowhere to put it.
  if (activity.sink === 'custom') {
    const metric = await findCustomMetric(userId, activity.metricId)
    if (!metric || metric.archivedAt || metric.type !== 'duration') {
      return { ok: false as const, error: 'invalid_input' as const }
    }
  }

  /*
   * There is one row per person, so starting a run used to overwrite whatever
   * was in it — a run left going on another device was destroyed rather than
   * counted. File it instead. This happens after the checks above, so a start
   * that is going to be refused cannot take the previous run down with it.
   */
  const previous = await fileHeldRun(settings)
  const filed = typeof previous === 'string' ? null : previous

  await persistTimer({
    userId,
    startedAt: new Date(),
    pausedAt: null,
    accumulatedSeconds: 0,
    activity: id,
    mode,
    // A countdown needs a target; a stopwatch must not carry a stale one.
    targetSeconds: mode === 'countdown' ? (targetMinutes ?? 25) * 60 : null,
    // `kind` and `target` are what the previous release reads. Writing them
    // keeps a run started here legible to it until that column is dropped.
    kind: isFocus ? activity.kind : 'learning',
    target: activity.sink === 'workout' ? 'workout' : 'focus',
    workoutType: activity.sink === 'workout' ? workoutType?.trim() || null : null,
    topicId: isFocus ? (topicId ?? null) : null,
    projectId: isFocus ? (projectId ?? null) : null,
    note: note ?? null,
  })

  revalidateTimer(filed?.date)
  return {
    ok: true as const,
    // What the start had to put away first, so the screen can say so rather
    // than filing minutes behind the person's back.
    filed: filed ? { minutes: filed.minutes, activity: filed.activity, sink: filed.sink } : null,
  }
}

export async function pauseTimer() {
  const userId = await getCurrentUserId()
  const timer = await findTimer(userId)
  if (!timer) return { ok: false as const, error: 'not_running' as const }
  if (timer.pausedAt) return { ok: true as const }

  const paused = pausedRun(timer)
  await updateTimer(userId, {
    pausedAt: paused.pausedAt,
    accumulatedSeconds: paused.accumulatedSeconds,
  })

  revalidateTimer()
  return { ok: true as const }
}

export async function resumeTimer() {
  const userId = await getCurrentUserId()
  const timer = await findTimer(userId)
  if (!timer) return { ok: false as const, error: 'not_running' as const }
  if (!timer.pausedAt) return { ok: true as const }

  const resumed = resumedRun(timer)
  await updateTimer(userId, { startedAt: resumed.startedAt, pausedAt: null })

  revalidateTimer()
  return { ok: true as const }
}

/** Throws the run away. Nothing is recorded — the opposite of stopping. */
export async function discardTimer() {
  await clearTimer(await getCurrentUserId())
  revalidateTimer()
  return { ok: true as const }
}

const stopSchema = z
  .object({ note: optionalText, rpe: z.number().int().min(1).max(10).nullable().optional() })
  .optional()

/**
 * Ends the run and files it where it belongs: focus time becomes a session,
 * exercise becomes a workout, and everything else is added to its column on
 * the daily log. Every path recomputes that day's derived habits, so a habit
 * bound to the metric ticks itself.
 */
export async function stopTimer(input?: unknown) {
  const parsed = stopSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const settings = await getSettings()
  const filed = await fileHeldRun(settings, parsed.data)

  if (filed === 'not_running') return { ok: false as const, error: 'not_running' as const }
  if (filed === 'too_short') {
    revalidateTimer()
    return { ok: false as const, error: 'too_short' as const }
  }

  revalidateTimer(filed.date)
  return {
    ok: true as const,
    minutes: filed.minutes,
    activity: filed.activity,
    sink: filed.sink,
    capped: filed.capped,
  }
}

const fileSchema = z.object({
  id: z.string().uuid(),
  activity: z.custom<ActivityId>(isActivityId),
  startedAt: z.string().datetime({ offset: true }),
  endedAt: z.string().datetime({ offset: true }),
  seconds: z.number().int().min(0).max(48 * 60 * 60),
  workoutType: z.string().max(80).nullable().optional(),
  topicId: optionalId,
  projectId: optionalId,
  note: optionalText,
  rpe: z.number().int().min(1).max(10).nullable().optional(),
})

/**
 * Files a completed run the device already stopped — including ones that
 * never reached `timer_state` because they started offline.
 *
 * The client-chosen `id` is claimed in `timer_filings` first so a drain that
 * retries after a half-answered request cannot double-count daily minutes.
 * If filing the sink fails, the claim is released and the queue can try again.
 */
export async function fileCompletedRun(input: unknown) {
  const parsed = fileSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const settings = await getSettings()
  const { id, seconds, startedAt, endedAt, workoutType, topicId, projectId, note, rpe } =
    parsed.data
  const activity = activityOf(parsed.data.activity)
  const minutes = minutesOf(seconds)
  const started = new Date(startedAt)
  const date = logicalDateOf(started, dayContextOf(settings))

  if (tooShort(seconds)) {
    await clearTimer(settings.userId)
    revalidateTimer()
    return { ok: false as const, error: 'too_short' as const }
  }

  const claimed = await db
    .insert(timerFilings)
    .values({ id, userId: settings.userId })
    .onConflictDoNothing()
    .returning({ id: timerFilings.id })

  if (claimed.length === 0) {
    await clearTimer(settings.userId)
    revalidateTimer(date)
    return {
      ok: true as const,
      minutes,
      activity: activity.id,
      sink: activity.sink,
      capped: wasCapped(seconds),
      duplicate: true as const,
    }
  }

  try {
    await fileToSink({
      userId: settings.userId,
      weekStart: settings.weekStart,
      activity,
      date,
      minutes,
      startedAt: started,
      endedAt: new Date(endedAt),
      workoutType: workoutType ?? null,
      topicId: topicId ?? null,
      projectId: projectId ?? null,
      note: note ?? null,
      rpe: rpe ?? null,
    })
  } catch (error) {
    await db.delete(timerFilings).where(eq(timerFilings.id, id))
    throw error
  }

  await clearTimer(settings.userId)
  revalidateTimer(date)
  return {
    ok: true as const,
    minutes,
    activity: activity.id,
    sink: activity.sink,
    capped: wasCapped(seconds),
  }
}

const syncSchema = z.object({
  startedAt: z.string().datetime({ offset: true }),
  pausedAt: z.string().datetime({ offset: true }).nullable(),
  accumulatedSeconds: z.number().int().min(0).max(48 * 60 * 60),
  activity: z.custom<ActivityId>(isActivityId),
  mode: z.enum(['stopwatch', 'countdown']),
  targetSeconds: z.number().int().min(60).max(86400).nullable(),
  workoutType: z.string().max(80).nullable().optional(),
  topicId: optionalId,
  projectId: optionalId,
  note: optionalText,
})

/**
 * Pushes a run that lived on the device (started or paused offline) onto
 * `timer_state`, so the badge on another device and the next online stop
 * see the same clock.
 */
export async function syncTimerState(input: unknown) {
  const parsed = syncSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const data = parsed.data
  const activity = activityOf(data.activity)
  const isFocus = activity.sink === 'focus'
  const userId = await getCurrentUserId()

  await persistTimer({
    userId,
    startedAt: new Date(data.startedAt),
    pausedAt: data.pausedAt ? new Date(data.pausedAt) : null,
    accumulatedSeconds: data.accumulatedSeconds,
    activity: data.activity,
    mode: data.mode,
    targetSeconds: data.targetSeconds,
    kind: isFocus ? activity.kind : 'learning',
    target: activity.sink === 'workout' ? 'workout' : 'focus',
    workoutType: activity.sink === 'workout' ? data.workoutType?.trim() || null : null,
    topicId: isFocus ? (data.topicId ?? null) : null,
    projectId: isFocus ? (data.projectId ?? null) : null,
    note: data.note ?? null,
  })

  revalidateTimer()
  return { ok: true as const }
}

async function fileToSink(values: {
  userId: string
  weekStart: 'monday' | 'sunday'
  activity: ReturnType<typeof activityOf>
  date: string
  minutes: number
  startedAt: Date
  endedAt: Date
  workoutType: string | null
  topicId: string | null
  projectId: string | null
  note: string | null
  rpe: number | null
}) {
  const { activity } = values

  if (activity.sink === 'workout') {
    await saveWorkout({
      performedOn: values.date,
      type: values.workoutType?.trim() || 'other',
      durationMinutes: values.minutes,
      rpe: values.rpe,
      note: values.note,
    })
  } else if (activity.sink === 'daily') {
    await addDailyMinutes({
      userId: values.userId,
      date: values.date,
      column: activity.column,
      minutes: values.minutes,
      weekStart: values.weekStart,
    })
  } else if (activity.sink === 'custom') {
    await addCustomMinutes({
      userId: values.userId,
      date: values.date,
      metricId: activity.metricId,
      minutes: values.minutes,
      weekStart: values.weekStart,
    })
  } else {
    await saveSessionAndDerive({
      userId: values.userId,
      sessionDate: values.date,
      minutes: values.minutes,
      kind: activity.kind,
      topicId: values.topicId,
      projectId: values.projectId,
      note: values.note,
      source: 'timer',
      startedAt: values.startedAt,
      endedAt: values.endedAt,
      weekStart: values.weekStart,
    })
  }
}
