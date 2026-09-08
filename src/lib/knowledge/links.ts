/** Pure helpers for note text. No database, no I/O. */

/**
 * `[[title]]` occurrences, de-duplicated, in first-seen order. Case is
 * preserved here; resolution against existing notes is case-insensitive.
 */
export function extractWikiLinks(body: string): string[] {
  const found = new Set<string>()
  for (const match of body.matchAll(/\[\[([^\][]{1,200})\]\]/g)) {
    const title = match[1]?.trim()
    if (title) found.add(title)
  }
  return [...found]
}

/** Tag input is comma-separated free text; normalize it once, here. */
export function parseTags(input: string): string[] {
  const seen = new Set<string>()
  for (const raw of input.split(',')) {
    const tag = raw.trim().replace(/^#/, '')
    if (tag) seen.add(tag)
  }
  return [...seen].slice(0, 20)
}
