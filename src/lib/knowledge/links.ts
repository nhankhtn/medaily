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

/** Note titles, lowercased, to their ids — what a `[[link]]` resolves against. */
export type NoteLinkTargets = Record<string, string>

export function noteLinkTargets(notes: { id: string; title: string }[]): NoteLinkTargets {
  const targets: NoteLinkTargets = {}
  // First writer wins, so two notes sharing a title resolve predictably to the
  // one the list already put first rather than to whichever came last.
  for (const note of notes) {
    const key = note.title.trim().toLowerCase()
    if (key && !(key in targets)) targets[key] = note.id
  }
  return targets
}

/**
 * Rewrites `[[title]]` into real Markdown links, for the notes that exist.
 *
 * A link to a note not written yet is deliberately left as `**[[title]]**`:
 * there is nowhere to send the reader, and the brackets are the honest signal
 * that this one is still an intention. It starts working on its own the day
 * that note is created, the same way the stored link does.
 *
 * The pattern matches `extractWikiLinks` exactly — a title containing a
 * bracket is not a link there, so it must not become one here.
 */
export function withResolvedWikiLinks(
  body: string,
  targets: NoteLinkTargets,
  hrefOf: (id: string) => string,
): string {
  return body.replace(/\[\[([^\][]{1,200})\]\]/g, (whole, raw: string) => {
    const title = raw.trim()
    if (!title) return whole

    const id = targets[title.toLowerCase()]
    return id ? `[${title}](${hrefOf(id)})` : `**[[${title}]]**`
  })
}
