'use client'

import { useEffect, useRef } from 'react'
import { lineInfo } from '@/lib/markdown'
import { cn } from '@/lib/utils'

/**
 * A Markdown box that dresses each line as you write it: `# ` makes the line a
 * heading there and then, `- ` indents a bullet, `> ` sets a quote off.
 *
 * It edits plain text — the value in and out is the Markdown source, marks and
 * all. What changes is how a line is drawn, never what it says, which is the
 * whole reason this can be done without fighting the caret: a class on a line
 * does not move it, and rewriting the line's contents would.
 *
 * The leading marker — the `# `, the `- ` — is wrapped and hidden, with a
 * bullet or a number shown in its place. It is hidden only on the lines the
 * caret is *not* in: the line being edited always shows its raw source, so a
 * `#` can be deleted, backspace behaves, and the caret never has to sit inside
 * something invisible. The text itself is untouched either way, so what gets
 * saved is still the Markdown that was typed.
 *
 * Inline marks (`**bold**`, a link) are left as written. Styling those means
 * wrapping part of a line while the caret sits inside it; the preview under
 * the box is where those are rendered instead.
 *
 * Two things this has to respect:
 *
 * - **Typing Vietnamese.** Telex composes a letter over several keystrokes,
 *   and touching the DOM mid-composition drops the tone mark. Nothing is
 *   restyled between `compositionstart` and `compositionend`.
 * - **The caret.** The line elements are rebuilt only when the shape of the
 *   text changes — a line added, removed, or newly turned into a heading — and
 *   the caret is put back by character offset when that happens. Ordinary
 *   typing inside a line touches nothing.
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  label,
  disabled,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label: string
  disabled?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const composing = useRef(false)
  /** What we last handed up, so a value echoed back is not a reason to redraw. */
  const emitted = useRef<string | null>(null)

  // Seed on mount, and follow the value when it changes from elsewhere — a
  // restored draft, a day copied from yesterday, an undo.
  useEffect(() => {
    const root = ref.current
    if (!root || composing.current) return
    if (value === emitted.current) return

    draw(root, value)
    emitted.current = value
  }, [value])

  // Which line the caret is in. Nothing is redrawn for this — one attribute
  // moves from one line element to another, and CSS does the rest.
  useEffect(() => {
    const root = ref.current
    if (!root) return

    const sync = () => markActive(root)
    document.addEventListener('selectionchange', sync)
    return () => document.removeEventListener('selectionchange', sync)
  }, [])

  const read = () => {
    const root = ref.current
    if (!root) return

    const text = textOf(root)

    if (shapeOf(text) !== shapeOf(emitted.current ?? '')) {
      const caret = selectionRange(root)
      draw(root, text)
      if (caret) placeCaret(root, caret.end)
      markActive(root)
    }

    emitted.current = text
    onChange(text)
  }

  /**
   * Home, taken over from the browser.
   *
   * With the marker in an element of its own, a browser's Home leaves the DOM
   * caret after that element while drawing it before — and then deletes the
   * marker when told to delete forwards. Measured, not guessed at: the caret
   * read as character 2 of `# abc` and `Delete` took out the `#`.
   *
   * So the app decides. Home goes to where the line's words start, which is
   * what the key is wanted for; pressing it again goes to the very start,
   * where the marker can be reached and deleted.
   */
  const goToLineStart = () => {
    const root = ref.current
    if (!root) return

    const at = selectionRange(root)
    if (!at) return

    const text = textOf(root)
    const start = text.lastIndexOf('\n', Math.max(0, at.end - 1)) + 1
    const break_ = text.indexOf('\n', start)
    const line = break_ === -1 ? text.slice(start) : text.slice(start, break_)
    const words = start + lineInfo(line).marker.length

    placeCaret(root, at.end === words ? start : words)
    markActive(root)
  }

  /**
   * Splitting and joining lines is done here rather than left to the browser.
   * Chrome answers one Enter with two empty line elements, and the redraw
   * turned the spare one into a line of its own — press Enter four times and
   * the box grew seven lines. Owning the structural edits keeps the browser to
   * what it is good at: typing inside a line.
   */
  const replaceSelection = (inserted: string) => {
    const root = ref.current
    if (!root) return

    const at = selectionRange(root) ?? { start: 0, end: 0 }
    const text = textOf(root)
    const next = text.slice(0, at.start) + inserted + text.slice(at.end)

    draw(root, next)
    placeCaret(root, at.start + inserted.length)
    markActive(root)
    emitted.current = next
    onChange(next)
  }

  return (
    <div
      ref={ref}
      // `plaintext-only` is what keeps this a text editor: the browser inserts
      // text and line breaks and never markup, so a paste from a web page
      // arrives as the words it was.
      contentEditable={disabled ? false : 'plaintext-only'}
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      aria-disabled={disabled || undefined}
      data-placeholder={placeholder}
      onInput={read}
      onKeyDown={(event) => {
        if (composing.current) return

        if (event.key === 'Enter') {
          event.preventDefault()
          replaceSelection('\n')
          return
        }

        if (event.key === 'Home' && !event.shiftKey) {
          event.preventDefault()
          goToLineStart()
        }
      }}
      onPaste={(event) => {
        // Whatever was copied, what lands is its text.
        event.preventDefault()
        replaceSelection(event.clipboardData.getData('text/plain').replace(/\r\n/g, '\n'))
      }}
      // Leaving the box is not a line being edited, and a browser keeps the
      // selection where it was — so the markers have to be put away by hand.
      onBlur={() => {
        const root = ref.current
        if (root) for (const line of root.children) line.removeAttribute('data-active')
      }}
      onCompositionStart={() => {
        composing.current = true
      }}
      onCompositionEnd={() => {
        composing.current = false
        read()
      }}
      className={cn(
        'glass-inset text-text min-h-20 w-full rounded-[var(--radius)] border-border-strong px-3 py-2 text-base',
        'focus:border-accent focus:inset-ring-accent focus:inset-ring-1 focus:outline-none',
        disabled && 'text-text-muted bg-surface-2',
        // The placeholder, since an empty contenteditable has no `::placeholder`.
        'empty:before:text-text-subtle empty:before:content-[attr(data-placeholder)]',
        '[&>[data-line]]:min-h-[1lh]',
        // The marker is out of sight except on the line being edited, where
        // the raw source comes back so it can be deleted like any other text.
        '[&_[data-mark]]:hidden',
        '[&>[data-line][data-active]_[data-mark]]:inline',
        // …and its stand-in is shown the other way round, so a line never
        // carries both a `- ` and a bullet. It sits in the indent rather than
        // in the text, which keeps every line of a list starting in the same
        // column however wide its marker is.
        '[&>[data-label]]:relative',
        '[&>[data-label]]:before:text-text-subtle [&>[data-label]]:before:absolute [&>[data-label]]:before:left-0 [&>[data-label]]:before:content-[attr(data-label)]',
        '[&>[data-label][data-active]]:before:hidden',
        '[&>[data-style=h1]]:text-lg [&>[data-style=h1]]:font-semibold',
        '[&>[data-style=h2]]:text-base [&>[data-style=h2]]:font-semibold',
        '[&>[data-style=h3]]:text-sm [&>[data-style=h3]]:font-semibold',
        '[&>[data-style=bullet]]:pl-6 [&>[data-style=ordered]]:pl-6 [&>[data-style=task]]:pl-6',
        '[&>[data-style=quote]]:border-border-strong [&>[data-style=quote]]:text-text-muted [&>[data-style=quote]]:border-l-2 [&>[data-style=quote]]:pl-2',
        '[&>[data-style=code]]:text-text-muted [&>[data-style=code]]:font-mono [&>[data-style=code]]:text-sm',
        '[&>[data-style=rule]]:border-border-strong [&>[data-style=rule]]:border-b',
        className,
      )}
    />
  )
}

/**
 * Everything the drawn elements depend on: how many lines there are, each
 * one's style, and how long its marker is and what stands in for it. The
 * marker's length matters because it is wrapped by character count, and the
 * stand-in because `1.` becoming `2.` changes nothing else.
 */
function shapeOf(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const { style, marker, label } = lineInfo(line)
      return `${style ?? '.'}:${marker.length}:${label}`
    })
    .join('|')
}

/**
 * The text as the line elements hold it.
 *
 * Not `innerText`: it counts the `<br>` filler inside an empty line as a break
 * of its own, so an empty last line came back as two, and redrawing from that
 * grew another empty line on every keystroke. The elements are drawn here, so
 * reading them back is exact. Before the first draw the browser may still have
 * a bare text node, and then `innerText` is right.
 */
function textOf(root: HTMLElement): string {
  const children = [...root.childNodes]
  if (children.length === 0) return ''
  if (children.every((node) => node.nodeType === Node.ELEMENT_NODE)) {
    return children.map((node) => node.textContent ?? '').join('\n')
  }
  return root.innerText.replace(/\r\n/g, '\n')
}

function draw(root: HTMLElement, text: string): void {
  // Truly empty, so `:empty` matches and the placeholder shows.
  if (text === '') {
    root.replaceChildren()
    return
  }

  const fragment = document.createDocumentFragment()

  for (const line of text.split('\n')) {
    const element = document.createElement('div')
    element.setAttribute('data-line', '')

    const { style, marker, label } = lineInfo(line)
    if (style) element.setAttribute('data-style', style)
    if (label) element.setAttribute('data-label', label)

    if (line === '') {
      // An empty line still needs a box to put the caret in.
      element.append(document.createElement('br'))
    } else if (marker === '') {
      element.append(document.createTextNode(line))
    } else {
      // Exactly the marker, so hiding it hides nothing else.
      const mark = document.createElement('span')
      mark.setAttribute('data-mark', '')
      mark.append(document.createTextNode(marker))
      element.append(mark)

      const rest = line.slice(marker.length)
      if (rest !== '') element.append(document.createTextNode(rest))
    }

    fragment.append(element)
  }

  root.replaceChildren(fragment)
}

/**
 * Where a point in the DOM falls, counted in characters from the start with
 * the newlines between lines included.
 *
 * Walks child *nodes*, not children: before the first draw the box holds a
 * bare text node rather than line elements, and reading only elements then
 * returned nothing — the caret was dropped and the next keystrokes landed at
 * the start of the box.
 */
function offsetOf(root: HTMLElement, container: Node, within: number): number | null {
  if (!root.contains(container)) return null
  const children = [...root.childNodes]

  // A point can sit between lines rather than inside one.
  if (container === root) {
    return children.slice(0, within).reduce((sum, node) => sum + lengthOf(node), 0)
  }

  let offset = 0
  for (const node of children) {
    if (node === container || node.contains(container)) {
      const upTo = document.createRange()
      upTo.selectNodeContents(node)
      upTo.setEnd(container, within)
      return offset + upTo.toString().length
    }
    offset += lengthOf(node)
  }

  return null
}

/**
 * Puts `data-active` on the line holding the caret, and takes it off the rest.
 * That line shows its marker; the others hide theirs.
 */
function markActive(root: HTMLElement): void {
  for (const line of root.children) line.removeAttribute('data-active')

  const node = window.getSelection()?.focusNode
  if (!node || !root.contains(node) || node === root) return

  let line = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  while (line && line !== root && line.parentElement !== root) line = line.parentElement
  if (line && line !== root && line.parentElement === root) line.setAttribute('data-active', '')
}

/** A line element carries the newline that follows it; a bare text node does not. */
function lengthOf(node: ChildNode): number {
  const text = (node.textContent ?? '').length
  return node.nodeType === Node.ELEMENT_NODE ? text + 1 : text
}

/** What is selected, as character offsets. Collapsed when nothing is. */
function selectionRange(root: HTMLElement): { start: number; end: number } | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  const start = offsetOf(root, range.startContainer, range.startOffset)
  const end = offsetOf(root, range.endContainer, range.endOffset)
  if (start === null || end === null) return null

  return start <= end ? { start, end } : { start: end, end: start }
}

function placeCaret(root: HTMLElement, offset: number): void {
  let remaining = offset

  for (const line of root.children) {
    const length = (line.textContent ?? '').length
    if (remaining > length) {
      remaining -= length + 1
      continue
    }

    const range = document.createRange()
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT)
    let seen = 0

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const size = node.textContent?.length ?? 0
      if (seen + size >= remaining) {
        range.setStart(node, remaining - seen)
        range.collapse(true)
        select(range)
        return
      }
      seen += size
    }

    // An empty line has no text node to sit in.
    range.selectNodeContents(line)
    range.collapse(true)
    select(range)
    return
  }
}

function select(range: Range): void {
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}
