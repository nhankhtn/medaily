import { elapsedSeconds } from '@/lib/timer'
import type { ActivityId } from '@/lib/timer/activities'
import { indexedDbStore, TIMER_RUN_STORE } from '@/lib/offline/indexeddb-store'
import type { PendingStore } from '@/lib/offline/store'
import type { RunningTimer } from '@/server/services/timer'

/**
 * The run this device is timing, whether or not the server has heard of it.
 *
 * `serverHasRun` is whether `timer_state` was written successfully.
 * `dirty` is whether a pause/resume on this device has not yet reached the
 * server — finishing a dirty run must file the device's seconds, not ask
 * the server to compute them from a stale row.
 */
export type StoredTimerRun = {
  id: 'current'
  runId: string
  startedAt: string
  pausedAt: string | null
  accumulatedSeconds: number
  activity: ActivityId
  mode: 'stopwatch' | 'countdown'
  targetSeconds: number | null
  workoutType: string | null
  topicId: string | null
  projectId: string | null
  note: string | null
  serverHasRun: boolean
  dirty: boolean
  updatedAt: number
  queuedAt: number
}

const CHANGED = 'medaily:timer-run'

let store: PendingStore<StoredTimerRun> | null = null

function runStore(): PendingStore<StoredTimerRun> {
  store ??= indexedDbStore<StoredTimerRun>(TIMER_RUN_STORE)
  return store
}

function announce(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGED))
}

export function toRunningTimer(run: StoredTimerRun): RunningTimer {
  const clock = {
    startedAt: new Date(run.startedAt),
    pausedAt: run.pausedAt ? new Date(run.pausedAt) : null,
    accumulatedSeconds: run.accumulatedSeconds,
  }

  return {
    startedAt: run.startedAt,
    pausedAt: run.pausedAt,
    accumulatedSeconds: run.accumulatedSeconds,
    elapsedSeconds: elapsedSeconds(clock),
    activity: run.activity,
    mode: run.mode,
    targetSeconds: run.targetSeconds,
    workoutType: run.workoutType,
    topicId: run.topicId,
    projectId: run.projectId,
    note: run.note,
  }
}

export async function readLocalRun(): Promise<StoredTimerRun | null> {
  const rows = await runStore().list()
  return rows.find((row) => row.id === 'current') ?? null
}

export async function writeLocalRun(
  run: Omit<StoredTimerRun, 'id' | 'queuedAt' | 'updatedAt'> & {
    updatedAt?: number
  },
): Promise<StoredTimerRun> {
  const entry: StoredTimerRun = {
    ...run,
    id: 'current',
    updatedAt: run.updatedAt ?? Date.now(),
    queuedAt: Date.now(),
  }
  await runStore().put(entry)
  announce()
  return entry
}

/**
 * After a stop, the server prop can still name the old run until the next
 * render. Seeding from that would resurrect a clock the user just filed.
 */
let suppressStartedAt: string | null = null

export async function clearLocalRun(opts?: { suppressStartedAt?: string }): Promise<void> {
  if (opts?.suppressStartedAt) suppressStartedAt = opts.suppressStartedAt
  await runStore().remove('current')
  announce()
}

export function takeSuppressStartedAt(): string | null {
  return suppressStartedAt
}

export function clearSuppressStartedAt(): void {
  suppressStartedAt = null
}

/** Sign-out: a run on this device belongs to the session that started it. */
export async function clearLocalTimerState(): Promise<void> {
  try {
    await runStore().clear()
    announce()
  } catch {
    /* signing out must not depend on the store answering */
  }
}

export function subscribeLocalRun(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange)
  return () => window.removeEventListener(CHANGED, onChange)
}

/** Seeds the local mirror from a server run the page just rendered. */
export function storedFromServer(timer: RunningTimer, runId = crypto.randomUUID()): StoredTimerRun {
  return {
    id: 'current',
    runId,
    startedAt: timer.startedAt,
    pausedAt: timer.pausedAt,
    accumulatedSeconds: timer.accumulatedSeconds,
    activity: timer.activity,
    mode: timer.mode,
    targetSeconds: timer.targetSeconds,
    workoutType: timer.workoutType,
    topicId: timer.topicId,
    projectId: timer.projectId,
    note: timer.note,
    serverHasRun: true,
    dirty: false,
    updatedAt: Date.now(),
    queuedAt: Date.now(),
  }
}
