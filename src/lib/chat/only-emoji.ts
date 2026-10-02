/**
 * Whether a message is nothing but emoji, so it can be drawn large.
 *
 * Deliberately shallow: a handful of characters, none of them a letter, a
 * digit or punctuation. `Extended_Pictographic` covers the pictures, and the
 * variation selectors and joiners are what hold a multi-part emoji together.
 */
export function onlyEmoji(body: string): boolean {
  const trimmed = body.trim()
  if (trimmed === '' || trimmed.length > 24) return false

  // At least one actual picture. `Emoji_Component` alone is not enough — it
  // includes the digits, because 0-9 are what keycap emoji are built from, so
  // "32434343" was being shouted across the room in thirty-six point type.
  if (!/\p{Extended_Pictographic}/u.test(trimmed)) return false
  return /^(\p{Extended_Pictographic}|\p{Emoji_Component}|\uFE0F|\u200D|\s)+$/u.test(trimmed)
}
