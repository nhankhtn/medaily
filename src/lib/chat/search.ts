/**
 * Matching words the way somebody types them.
 *
 * Message bodies are sealed at rest, so there is no index to query and no
 * collation to lean on: the server opens a page at a time and compares here.
 * That makes this the whole of what "found" means, which is why it is pure and
 * why it lives apart from the scan that uses it.
 *
 * Vietnamese is the reason it is not `toLowerCase().includes()`. People type
 * "hop" and mean "họp" — leaving the marks in would make the search work only
 * for somebody who had already typed the word correctly, which is rarely the
 * person looking for it.
 */

/**
 * `đ` survives NFD: it is one character rather than a letter with a mark on
 * it, so nothing is decomposed and nothing is stripped.
 */
const STROKE = /[đĐ]/g

/** Everything NFD separates out — the marks, once they stand alone. */
const MARKS = /[̀-ͯ]/g

/** Lower case, no marks, single spaces. */
export function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(MARKS, '')
    .replace(STROKE, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Whether a message answers what was typed.
 *
 * Substring rather than whole words: half a word is what somebody has when
 * they are looking for the rest of it, and a room is small enough that the
 * looser answer costs nothing.
 */
export function matches(body: string, query: string): boolean {
  const needle = normalise(query)
  return needle !== '' && normalise(body).includes(needle)
}
