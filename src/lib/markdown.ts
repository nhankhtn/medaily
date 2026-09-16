/**
 * What a line of Markdown is, so an editor can dress it without rewriting it.
 *
 * Only the marks that a whole line carries. Inline ones — `**bold**`, a link,
 * a table — are deliberately absent: styling those means wrapping parts of a
 * line in elements, and the caret sits inside a line while it is being typed.
 * Changing a line's class never moves the caret; changing its contents does.
 */
export type LineStyle =
  'h1' | 'h2' | 'h3' | 'bullet' | 'ordered' | 'task' | 'quote' | 'code' | 'rule' | null

/**
 * A line's style, the leading characters that only say what the line is, and
 * what to show in their place once they are out of sight.
 *
 * The marker is measured rather than removed. The editor wraps exactly those
 * characters so it can hide them, which keeps the text of the line the
 * Markdown source it always was — the moment a marker is deleted from the
 * value, what is stored changes with it.
 *
 * `label` is the stand-in: a real bullet for `- `, the typed number for an
 * ordered item, a box for a task. Headings and quotes have none, because size
 * and a rule down the side already say it.
 */
export type LineInfo = { style: LineStyle; marker: string; label: string }

export function lineInfo(line: string): LineInfo {
  const plain: LineInfo = { style: null, marker: '', label: '' }

  // Up to three leading spaces still makes a heading (CommonMark); four is
  // an indented code block. Without this a stray space silently un-headings a
  // line, which is baffling when the marker is out of sight.
  const heading = /^ {0,3}(#{1,6})[ \t]+(?=\S)/.exec(line)
  if (heading) {
    const depth = heading[1]?.length ?? 1
    return {
      style: depth === 1 ? 'h1' : depth === 2 ? 'h2' : 'h3',
      marker: heading[0],
      label: '',
    }
  }

  // A rule is nothing but its marker, and a border draws it instead.
  if (/^\s*(?:[-*_]\s*){3,}$/.test(line)) return { style: 'rule', marker: line, label: '' }

  const task = /^\s*[-*+]\s+\[([ xX])\]\s/.exec(line)
  if (task) {
    return { style: 'task', marker: task[0], label: task[1] === ' ' ? '\u2610' : '\u2611' }
  }

  const bullet = /^\s*[-*+]\s+(?=\S)/.exec(line)
  if (bullet) return { style: 'bullet', marker: bullet[0], label: '\u2022' }

  const ordered = /^\s*(\d+)[.)]\s+(?=\S)/.exec(line)
  if (ordered) return { style: 'ordered', marker: ordered[0], label: `${ordered[1]}.` }

  const quote = /^\s*>\s?/.exec(line)
  if (quote) return { style: 'quote', marker: quote[0], label: '' }

  // A fence is left alone: hiding it would hide where the block ends.
  if (/^\s*(?:```|~~~)/.test(line)) return { style: 'code', marker: '', label: '' }

  return plain
}

export function lineStyle(line: string): LineStyle {
  return lineInfo(line).style
}

/**
 * Marks that live inside a line, which the editor cannot show in place — the
 * preview underneath is for these and nothing else. A heading is already a
 * heading in the box; repeating it below would be the same words twice.
 */
const INLINE_PATTERNS: RegExp[] = [
  /\*\*[^*\n]+\*\*/, // **bold**
  /(?<![*\w])\*[^*\n]+\*(?!\w)/, // *italic*
  /~~[^~\n]+~~/, // ~~struck~~
  /`[^`\n]+`/, // `code`
  /!?\[[^\]\n]*\]\([^)\s]+\)/, // [link](url)
  /\[\[[^\]\n]+\]\]/, // [[wiki link]]
  /^\s*\|.*\|/m, // | table |
]

export function hasInlineMarkdown(text: string | null | undefined): boolean {
  if (!text) return false
  return INLINE_PATTERNS.some((pattern) => pattern.test(text))
}

/** Any Markdown at all, inline or whole-line. */
export function hasMarkdown(text: string | null | undefined): boolean {
  if (!text) return false
  if (hasInlineMarkdown(text)) return true
  return text.split('\n').some((line) => lineStyle(line) !== null)
}
