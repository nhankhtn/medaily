/**
 * How consecutive messages stack into runs, and where a day begins.
 *
 * This is what separates a chat from a log. A log gives every line the same
 * weight: a name, a time, a rule beneath it. A chat says who is speaking once
 * and then gets out of the way, so five messages in a row from one person read
 * as one person talking rather than five separate events.
 *
 * Pure, because it is the part worth being sure about: the name is drawn from
 * `startsRun` and the avatar from `endsRun`, and getting either backwards puts
 * a face beside the wrong line or repeats a name down the whole screen.
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

/**
 * How long a silence has to be before the next message starts a new run.
 *
 * Five minutes is the gap at which two messages stop being one thought. Longer
 * and a conversation picked up after lunch runs into the morning's; shorter and
 * somebody typing slowly gets their name repeated mid-sentence.
 */
export const RUN_GAP_MS = 5 * 60 * 1000

/** The two fields grouping reads. Anything with them can be laid out. */
export type Groupable = {
  userId: string | null
  /** ISO, or empty for a message that is still on its way to the server. */
  createdAt: string
}

/**
 * When a message happened, in milliseconds.
 *
 * A message with no timestamp has not been acknowledged yet, and it was typed
 * just now by definition — so it belongs to the run above it rather than
 * starting one of its own.
 */
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
 * Whether two messages belong to the same run.
 *
 * A day boundary ends a run whatever the clock says — two messages four
 * minutes apart across midnight are separated by a date line on screen, and a
 * run that continued across it would have its name stranded above the line.
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
  // The first message in the transcript gets no separator: there is nothing
  // above it for the date to be separating it from, and a label alone at the
  // top of a conversation reads as a heading nobody asked for.
  const startsDay = Boolean(previous) && dayKeyOf(previous!, now) !== dayKeyOf(current, now)

  return { startsRun, endsRun, startsDay }
}
