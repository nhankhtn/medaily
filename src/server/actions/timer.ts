'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { logicalDateOf } from '@/lib/dates'
import { PATHS } from '@/lib/paths'
import { elapsedSeconds, minutesOf, pausedRun, resumedRun, wasCapped } from '@/lib/timer'
import { saveWorkout } from '@/server/actions/health'
import {
  clearTimer,
  findTimer,
  startTimer as persistTimer,
  updateTimer,
} from '@/server/repositories/timer'
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
  target: z.enum(['focus', 'workout']).default('focus'),
  mode: z.enum(['stopwatch', 'countdown']).default('stopwatch'),
  targetMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  kind: z.enum(['learning', 'deep_work', 'project']).default('learning'),
  workoutType: z.string().max(80).nullable().optional(),
  topicId: optionalId,
  projectId: optionalId,
  note: optionalText,
})

export async function startTimer(input: unknown) {
  const parsed = startSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const { target, mode, targetMinutes, kind, workoutType, topicId, projectId, note } = parsed.data

  await persistTimer({
    userId: await getCurrentUserId(),
    startedAt: new Date(),
    pausedAt: null,
    accumulatedSeconds: 0,
    target,
    mode,
    // A countdown needs a target; a stopwatch must not carry a stale one.
    targetSeconds: mode === 'countdown' ? (targetMinutes ?? 25) * 60 : null,
    kind,
    workoutType: target === 'workout' ? (workoutType?.trim() || null) : null,
    topicId: target === 'focus' ? (topicId ?? null) : null,
    projectId: target === 'focus' ? (projectId ?? null) : null,
    note: note ?? null,
  })

  revalidateTimer()
  return { ok: true as const }
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
 * exercise becomes a workout. Both paths recompute the day's derived habits, so
 * a habit bound to study or exercise minutes ticks itself.
 */
export async function stopTimer(input?: unknown) {
  const parsed = stopSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const settings = await getSettings()
  const timer = await findTimer(settings.userId)
  if (!timer) return { ok: false as const, error: 'not_running' as const }

  const seconds = elapsedSeconds(timer)
  const minutes = minutesOf(seconds)
  const date = logicalDateOf(timer.startedAt, dayContextOf(settings))

  if (minutes < 1) {
    await clearTimer(settings.userId)
    revalidateTimer()
    return { ok: false as const, error: 'too_short' as const }
  }

  const note = parsed.data?.note ?? timer.note

  if (timer.target === 'workout') {
    await saveWorkout({
      performedOn: date,
      type: timer.workoutType?.trim() || 'other',
      durationMinutes: minutes,
      rpe: parsed.data?.rpe ?? null,
      note,
    })
  } else {
    await saveSessionAndDerive({
      userId: settings.userId,
      sessionDate: date,
      minutes,
      kind: timer.kind,
      topicId: timer.topicId,
      projectId: timer.projectId,
      note,
      source: 'timer',
      startedAt: timer.startedAt,
      endedAt: new Date(),
      weekStart: settings.weekStart,
    })
  }

  await clearTimer(settings.userId)
  revalidateTimer(date)
  return {
    ok: true as const,
    minutes,
    target: timer.target,
    capped: wasCapped(seconds),
  }
}
