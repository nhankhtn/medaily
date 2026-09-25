import { activityOf, type ActivityId } from '@/lib/timer/activities'
import { elapsedSeconds, minutesOf, pausedRun, resumedRun, tooShort, wasCapped } from '@/lib/timer'
import {
  clearLocalRun,
  readLocalRun,
  toRunningTimer,
  writeLocalRun,
  type StoredTimerRun,
} from './local-run'
import { queuePendingStop } from './pending-stops'
import {
  discardTimer,
  fileCompletedRun,
  pauseTimer,
  resumeTimer,
  startTimer,
  stopTimer,
  syncTimerState,
} from '@/server/actions/timer'

export type BeginInput = {
  activity: ActivityId
  mode: 'stopwatch' | 'countdown'
  targetMinutes: number
  topicId: string | null
  projectId: string | null
  workoutType: string | null
  note: string | null
}

export type FinishResult =
  | {
      ok: true
      minutes: number
      sink: ReturnType<typeof activityOf>['sink']
      capped: boolean
      queued?: boolean
    }
  | { ok: false; error: 'too_short' | 'invalid_input' | 'error' }

/** A run the server had to file to make room for this one. */
export type FiledOnStart = {
  minutes: number
  activity: ActivityId
  sink: ReturnType<typeof activityOf>['sink']
}

export type BeginResult = { ok: true; filed: FiledOnStart | null } | { ok: false }

/**
 * Starts a run on this device first, then mirrors to the server when it can.
 * Offline is not a failure — the clock keeps going and sync catches up.
 */
export async function beginRun(input: BeginInput): Promise<BeginResult> {
  const now = new Date()
  const runId = crypto.randomUUID()
  const targetSeconds = input.mode === 'countdown' ? input.targetMinutes * 60 : null

  await writeLocalRun({
    runId,
    startedAt: now.toISOString(),
    pausedAt: null,
    accumulatedSeconds: 0,
    activity: input.activity,
    mode: input.mode,
    targetSeconds,
    workoutType: input.workoutType,
    topicId: input.topicId,
    projectId: input.projectId,
    note: input.note,
    serverHasRun: false,
    dirty: true,
  })

  try {
    const result = await startTimer({
      activity: input.activity,
      mode: input.mode,
      targetMinutes: input.targetMinutes,
      topicId: input.topicId,
      projectId: input.projectId,
      workoutType: input.workoutType,
      note: input.note,
    })
    if (!result.ok) {
      await clearLocalRun()
      return { ok: false }
    }
    await writeLocalRun({
      runId,
      startedAt: now.toISOString(),
      pausedAt: null,
      accumulatedSeconds: 0,
      activity: input.activity,
      mode: input.mode,
      targetSeconds,
      workoutType: input.workoutType,
      topicId: input.topicId,
      projectId: input.projectId,
      note: input.note,
      serverHasRun: true,
      dirty: false,
    })
    return { ok: true, filed: result.filed ?? null }
  } catch (error) {
    console.error('[timer] start did not reach the server; running offline:', error)
    return { ok: true, filed: null }
  }
}

export async function togglePauseRun(): Promise<void> {
  const run = await readLocalRun()
  if (!run) return

  const clock = {
    startedAt: new Date(run.startedAt),
    pausedAt: run.pausedAt ? new Date(run.pausedAt) : null,
    accumulatedSeconds: run.accumulatedSeconds,
  }

  const next = run.pausedAt === null ? pausedRun(clock) : resumedRun(clock)
  const updated: Omit<StoredTimerRun, 'id' | 'queuedAt' | 'updatedAt'> = {
    ...run,
    startedAt: next.startedAt.toISOString(),
    pausedAt: next.pausedAt ? next.pausedAt.toISOString() : null,
    accumulatedSeconds: next.accumulatedSeconds,
    dirty: true,
  }
  await writeLocalRun(updated)

  try {
    const result = await (run.pausedAt === null ? pauseTimer() : resumeTimer())
    if (result.ok) {
      await writeLocalRun({ ...updated, dirty: false, serverHasRun: true })
    }
  } catch (error) {
    console.error('[timer] pause/resume stayed on this device:', error)
  }
}

export async function finishRun(input?: {
  note?: string | null
  rpe?: number | null
}): Promise<FinishResult> {
  const run = await readLocalRun()
  if (!run) return { ok: false, error: 'error' }

  const seconds = elapsedSeconds({
    startedAt: new Date(run.startedAt),
    pausedAt: run.pausedAt ? new Date(run.pausedAt) : null,
    accumulatedSeconds: run.accumulatedSeconds,
  })
  const activity = activityOf(run.activity)
  const endedAt = new Date().toISOString()
  const note = input?.note ?? run.note

  await clearLocalRun({ suppressStartedAt: run.startedAt })

  if (tooShort(seconds)) {
    try {
      await discardTimer()
    } catch {
      /* offline discard is fine — there may be nothing on the server */
    }
    return { ok: false, error: 'too_short' }
  }

  const payload = {
    id: run.runId,
    activity: run.activity,
    startedAt: run.startedAt,
    endedAt,
    seconds,
    workoutType: run.workoutType,
    topicId: run.topicId,
    projectId: run.projectId,
    note,
    rpe: input?.rpe ?? null,
  }

  const done = {
    ok: true as const,
    minutes: minutesOf(seconds),
    sink: activity.sink,
    capped: wasCapped(seconds),
  }

  try {
    // A clean mirror can use the ordinary stop; anything else must file the
    // device's own seconds (offline start, or pause that never synced).
    if (run.serverHasRun && !run.dirty) {
      const result = await stopTimer({ note, rpe: input?.rpe ?? null })
      if (!result.ok) {
        return { ok: false, error: result.error === 'too_short' ? 'too_short' : 'error' }
      }
      return {
        ok: true,
        minutes: result.minutes,
        sink: result.sink,
        capped: result.capped,
      }
    }

    const result = await fileCompletedRun(payload)
    if (!result.ok) {
      return { ok: false, error: result.error === 'too_short' ? 'too_short' : 'invalid_input' }
    }
    return done
  } catch (error) {
    console.error('[timer] stop queued offline:', error)
    try {
      await queuePendingStop({
        ...payload,
        mode: run.mode,
        targetSeconds: run.targetSeconds,
      })
      return { ...done, queued: true }
    } catch (kept) {
      console.error('[timer] could not keep the stopped run on this device:', kept)
      return { ok: false, error: 'error' }
    }
  }
}

export async function dropRun(): Promise<void> {
  const run = await readLocalRun()
  await clearLocalRun(run ? { suppressStartedAt: run.startedAt } : undefined)
  try {
    await discardTimer()
  } catch (error) {
    console.error('[timer] discard stayed local:', error)
  }
}

/** Pushes a dirty local run to the server when the network returns. */
export async function syncLocalRunIfNeeded(): Promise<void> {
  const run = await readLocalRun()
  if (!run || (!run.dirty && run.serverHasRun)) return

  try {
    const result = await syncTimerState({
      startedAt: run.startedAt,
      pausedAt: run.pausedAt,
      accumulatedSeconds: run.accumulatedSeconds,
      activity: run.activity,
      mode: run.mode,
      targetSeconds: run.targetSeconds,
      workoutType: run.workoutType,
      topicId: run.topicId,
      projectId: run.projectId,
      note: run.note,
    })
    if (result.ok) {
      await writeLocalRun({ ...run, serverHasRun: true, dirty: false })
    }
  } catch (error) {
    console.error('[timer] could not sync the running clock:', error)
  }
}

export { toRunningTimer, readLocalRun }
