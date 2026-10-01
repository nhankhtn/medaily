/**
 * The stickers this app ships with.
 *
 * Drawn here rather than fetched or bundled from a set, so there is no licence
 * to honour and nothing to download — the whole pack costs about two kilobytes
 * and renders at any size. Swapping in a bought or commissioned set later means
 * replacing `draw` and keeping the ids, which is why the ids are words rather
 * than numbers.
 *
 * **An id is a closed vocabulary, not free text.** A sticker message stores the
 * id in `body`, and a message whose id is not in this list renders as nothing.
 * Without that, anybody could store a string and have it treated as a picture.
 */
export const STICKERS = [
  'like',
  'love',
  'laugh',
  'sad',
  'angry',
  'fire',
  'clap',
  'party',
  'coffee',
  'sleep',
  'run',
  'ok',
] as const

export type StickerId = (typeof STICKERS)[number]

const KNOWN = new Set<string>(STICKERS)

/** A stored id from an older deploy may name one this build no longer draws. */
export function isSticker(value: unknown): value is StickerId {
  return typeof value === 'string' && KNOWN.has(value)
}

/**
 * Emoji a message can be reacted with.
 *
 * A fixed row rather than a picker: reactions are stored per message, and an
 * open vocabulary makes the document grow with whatever anybody types. Six is
 * also about as many as a phone can show without wrapping.
 */
export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'] as const

export type Reaction = (typeof REACTIONS)[number]

const REACTABLE = new Set<string>(REACTIONS)

export function isReaction(value: unknown): value is Reaction {
  return typeof value === 'string' && REACTABLE.has(value)
}
