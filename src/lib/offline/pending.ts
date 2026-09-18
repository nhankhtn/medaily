import type { ISODate } from '@/lib/dates'

/**
 * A save the user pressed but the network would not carry, held on the device
 * until it can be sent.
 *
 * This is not the draft in `use-draft`. A draft is "you typed this and have
 * not submitted it"; a pending save is "you submitted it and we could not
 * reach the server". Conflating them would either lose a save or re-send
 * something nobody asked to save.
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

/**
 * Adds a save, replacing any earlier one for the same day.
 *
 * `saveDay` writes the whole form for a date, so an earlier queued save for
 * that date is already superseded by this one — keeping both would replay a
 * value the user has since changed.
 */
export function enqueue(list: PendingSave[], entry: PendingSave): PendingSave[] {
  const others = list.filter((pending) => pending.date !== entry.date)
  // Oldest first, and the cap drops the oldest: a queue this long is not going
  // to drain, and the recent days are the ones still worth sending.
  return [...others, entry].sort((a, b) => a.queuedAt - b.queuedAt).slice(-MAX_PENDING)
}


/**
 * Whether a rejection means this entry will never succeed.
 *
 * A network failure is worth another try; a validation failure is not. Without
 * the distinction one bad entry sits at the head of the queue and blocks every
 * good one behind it, retried forever.
 */
export function isPermanentFailure(error: string): boolean {
  return error === 'invalid_input' || error === 'future_date'
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
 * The whole branch table of a drain, in one place so it can be asserted.
 *
 * `null` means the call threw, which is what a Server Action does with no
 * network. Getting one of these three wrong either loses an evening someone
 * logged or retries an unsendable day on every reconnect for as long as the
 * app is installed, so it is worth more than a careful reading.
 */
export function decide(result: SendResult | null): Decision {
  if (result === null) return 'stop'
  if (result.ok) return 'sent'
  return isPermanentFailure(result.error) ? 'dropped' : 'stop'
}
