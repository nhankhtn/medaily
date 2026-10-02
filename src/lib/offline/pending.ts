import type { ISODate } from '@/lib/dates'

/**
 * A save the network would not carry. Not a draft: a draft was never
 * submitted, this one was.
 */
export type PendingSave = {
  date: ISODate
  /** The same shape `saveDay` takes, kept opaque so this file stays pure. */
  patch: unknown
  custom: unknown
  queuedAt: number
}

/** More than a season of unsent days means something is wrong, not busy. */
export const MAX_PENDING = 120

/** `saveDay` writes the whole form, so an earlier save for that day is dead. */
export function enqueue(list: PendingSave[], entry: PendingSave): PendingSave[] {
  const others = list.filter((pending) => pending.date !== entry.date)
  // Oldest first, and the cap drops the oldest: a queue this long is not
  // draining, and recent days are the ones worth sending.
  return [...others, entry].sort((a, b) => a.queuedAt - b.queuedAt).slice(-MAX_PENDING)
}

/** Without this, one unsendable entry blocks every good one behind it. */
export function isPermanentFailure(error: string): boolean {
  return error === 'invalid_input' || error === 'future_date' || error === 'too_short'
}

/** What `saveDay` answers, narrowed to what the queue needs to decide. */
export type SendResult = { ok: true } | { ok: false; error: string }

export type Decision =
  /** Landed on the server; drop it from the queue. */
  | 'sent'
  /** Refused for good; drop it, or it blocks every day behind it forever. */
  | 'dropped'
  /** Might work later; keep it and stop draining for now. */
  | 'stop'

/**
 * The branch table of a drain, in one place so it can be asserted. `null` is
 * the action throwing, which is what no network looks like.
 */
export function decide(result: SendResult | null): Decision {
  if (result === null) return 'stop'
  if (result.ok) return 'sent'
  return isPermanentFailure(result.error) ? 'dropped' : 'stop'
}

/**
 * Carries its own browser-made `id`, which is what makes a retry safe: two
 * coffees on one afternoon are two rows, so there is no natural key to fall
 * back on.
 */
export type QueuedTransaction = {
  id: string
  occurredOn: ISODate
  amount: number
  kind: 'income' | 'expense' | 'transfer'
  accountId: string
  counterAccountId: string | null
  categoryId: string | null
  personId: string | null
  /**
   * Optional because entries written before transfers existed are still in the
   * store, and a drain that choked on them would strand real money.
   */
  payeePersonId?: string | null
  merchant: string | null
  queuedAt: number
}

/**
 * Carries the seconds the device counted: the server has no running row for an
 * offline start, and a run paused offline disagrees with `timer_state`.
 */
export type QueuedTimerStop = {
  id: string
  activity: string
  startedAt: string
  endedAt: string
  seconds: number
  mode: 'stopwatch' | 'countdown'
  targetSeconds: number | null
  workoutType: string | null
  topicId: string | null
  projectId: string | null
  note: string | null
  rpe: number | null
  queuedAt: number
}
