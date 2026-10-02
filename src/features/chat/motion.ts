/** Pure decisions behind the transcript's motion, kept apart so they can be tested. */

export type EasterEgg = 'confetti' | 'balloons'

/** Lowercased with the marks stripped, so "Chúc mừng" and "chuc mung" both count. */
function folded(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

const BIRTHDAY = ['happy birthday', 'sinh nhat vui ve', 'chuc mung sinh nhat', 'hpbd']
const CONGRATS = ['chuc mung', 'congrat']

/** Birthday first: "chúc mừng sinh nhật" also contains "chúc mừng". */
export function easterEggOf(body: string): EasterEgg | null {
  const text = folded(body)
  if (BIRTHDAY.some((phrase) => text.includes(phrase))) return 'balloons'
  if (CONGRATS.some((phrase) => text.includes(phrase))) return 'confetti'
  return null
}

/**
 * The tail side's corners. The bottom one is always the tail; the top one only
 * tucks in when a message sits above it in the same run.
 */
export function bubbleCorners({ mine, startsRun }: { mine: boolean; startsRun: boolean }): string {
  if (mine) return startsRun ? 'rounded-br-md' : 'rounded-r-md'
  return startsRun ? 'rounded-bl-md' : 'rounded-l-md'
}

type Readable = { id: string; userId: string | null }

/**
 * Where "N new" goes: the first message from somebody else after the one I had
 * read up to. Null when the mark is not on this page — a count from there would
 * be a guess.
 */
export function unreadStart(
  messages: Readable[],
  mark: string | null,
  me: string,
): { id: string; count: number } | null {
  if (!mark) return null
  const at = messages.findIndex((message) => message.id === mark)
  if (at < 0) return null

  const theirs = messages.slice(at + 1).filter((message) => message.userId !== me)
  const first = theirs[0]
  return first ? { id: first.id, count: theirs.length } : null
}

/** The reaction whose count went up, if one did — that is the chip that pops. */
export function grownReaction(
  before: Record<string, number>,
  after: Record<string, number>,
): string | null {
  for (const [emoji, count] of Object.entries(after)) {
    if (count > (before[emoji] ?? 0)) return emoji
  }
  return null
}

/** How far left a thumb has to drag a message before letting go replies to it. */
export const SWIPE_REPLY_PX = 56

/**
 * Whether a drag is a sideways swipe rather than the start of a scroll. Decided
 * once, early: a gesture that changed its mind half-way would fight the list.
 */
export function swipeIntent(dx: number, dy: number): 'swipe' | 'scroll' | null {
  if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return null
  return dx < 0 && Math.abs(dx) > Math.abs(dy) * 1.5 ? 'swipe' : 'scroll'
}
