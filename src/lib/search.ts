/**
 * Shared between the command palette and the action behind it. It cannot live
 * in the action file: a `'use server'` module may export nothing but async
 * functions.
 */

/** Below this a search matches most of the database and helps nobody. */
export const MIN_QUERY_LENGTH = 2

/**
 * How many results the palette asks for. The list scrolls, so this is not
 * about the room on screen — it is the point past which more rows stop being
 * an answer and start being a haystack. Narrow the words instead.
 */
export const SEARCH_LIMIT = 30

/**
 * A snippet a person can read.
 *
 * Notes are markdown, and a raw excerpt of one is mostly punctuation —
 * "## Sở thích - Cà phê **sữa đá**" says less than the words inside it. This
 * keeps the words and drops the syntax; it is not a parser and does not need
 * to be, because the result is one truncated line either way.
 */
export function plainSnippet(text: string | null): string | null {
  if (!text) return null

  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*[>#]+\s?/gm, ' ')
    .replace(/^\s*[-*+]\s+/gm, ' ')
    .replace(/^\s*\d+\.\s+/gm, ' ')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return plain || null
}
