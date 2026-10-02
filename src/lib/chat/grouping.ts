/**
 * How consecutive messages stack into runs — what separates a chat from a log.
 * Pure, because the name is drawn from `startsRun` and the avatar from
 * `endsRun`, and either one backwards is visible on every screen.
 */

/** What the renderer needs to know about one row's place in the transcript. */
export type RowLayout = {
  /** First of a run — carries the sender's name. */
  startsRun: boolean
  /** Last of a run — carries the avatar and the tail corner. */
  endsRun: boolean
  /** A new calendar day begins here, so a separator is drawn above it. */
  startsDay: boolean
}

/** The gap at which two messages stop being one thought. */
export const RUN_GAP_MS = 5 * 60 * 1000

/** The two fields grouping reads. Anything with them can be laid out. */
export type Groupable = {
  userId: string | null
  /** ISO, or empty for a message that is still on its way to the server. */
  createdAt: string
}

/** No timestamp means not yet acknowledged, which means typed just now. */
function timeOf(message: Groupable, now: number): number {
  if (message.createdAt === '') return now
  const at = new Date(message.createdAt).getTime()
  return Number.isNaN(at) ? now : at
}

/** `2026-09-30` in local time — what "the same day" means to whoever is reading. */
export function dayKeyOf(message: Groupable, now: number): string {
  const at = new Date(timeOf(message, now))
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

/**
 * A day boundary ends a run whatever the clock says, or the run's name would
 * be stranded above the date line.
 */
function sameRun(previous: Groupable, current: Groupable, now: number): boolean {
  if (previous.userId !== current.userId) return false
  if (dayKeyOf(previous, now) !== dayKeyOf(current, now)) return false
  return timeOf(current, now) - timeOf(previous, now) < RUN_GAP_MS
}

/** Where one row sits, given its neighbours. */
export function layoutAt<T extends Groupable>(
  messages: T[],
  index: number,
  now: number,
): RowLayout {
  const current = messages[index]
  if (!current) return { startsRun: true, endsRun: true, startsDay: false }

  const previous = index > 0 ? messages[index - 1] : undefined
  const next = messages[index + 1]

  const startsRun = !previous || !sameRun(previous, current, now)
  const endsRun = !next || !sameRun(current, next, now)
  // No separator above the first message: nothing for it to separate.
  const startsDay = Boolean(previous) && dayKeyOf(previous!, now) !== dayKeyOf(current, now)

  return { startsRun, endsRun, startsDay }
}
