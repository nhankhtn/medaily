import { PATHS } from '@/lib/paths'

/**
 * Every key the app listens for, in one registry.
 *
 * The handlers used to own their own keys, which was simpler until the keys
 * became editable: the list a person edits and the listener that fires have to
 * read the same source, or a remapped key silently keeps doing the old thing.
 */

export type ShortcutGroup = 'everywhere' | 'goto' | 'daily' | 'timer'

export type ShortcutAction = {
  id: string
  group: ShortcutGroup
  /** `nav.*` for the jumps, `settings.shortcuts.items.*` for the rest. */
  labelNamespace?: 'nav'
  binding: string
  /** Jumps need somewhere to jump to. */
  href?: string
  /** Only offered when a Gemini key is configured. */
  needsCapture?: boolean
}

/**
 * A binding is text so it survives a round trip through jsonb unchanged:
 * `mod+k`, `?`, `g d`. A space means "then" — press the keys in order.
 */
export const ACTIONS: readonly ShortcutAction[] = [
  { id: 'palette', group: 'everywhere', binding: 'mod+k' },
  { id: 'capture', group: 'everywhere', binding: 'mod+j', needsCapture: true },
  { id: 'shortcuts', group: 'everywhere', binding: '?' },

  { id: 'home', group: 'goto', labelNamespace: 'nav', binding: 'g o', href: PATHS.home },
  { id: 'daily', group: 'goto', labelNamespace: 'nav', binding: 'g d', href: PATHS.daily },
  { id: 'habits', group: 'goto', labelNamespace: 'nav', binding: 'g h', href: PATHS.habits },
  { id: 'goals', group: 'goto', labelNamespace: 'nav', binding: 'g g', href: PATHS.goals },
  { id: 'analytics', group: 'goto', labelNamespace: 'nav', binding: 'g a', href: PATHS.analytics },
  { id: 'settings', group: 'goto', labelNamespace: 'nav', binding: 'g s', href: PATHS.settings },

  { id: 'prevDay', group: 'daily', binding: '[' },
  { id: 'nextDay', group: 'daily', binding: ']' },
  { id: 'today', group: 'daily', binding: 't' },
  { id: 'save', group: 'daily', binding: 's' },

  { id: 'toggleTimer', group: 'timer', binding: 'space' },
] as const

export const GROUP_ORDER: readonly ShortcutGroup[] = ['everywhere', 'goto', 'daily', 'timer']

export type Bindings = Record<string, string>

export const DEFAULT_BINDINGS: Bindings = Object.fromEntries(
  ACTIONS.map((action) => [action.id, action.binding]),
)

export const actionById = (id: string): ShortcutAction | undefined =>
  ACTIONS.find((action) => action.id === id)

/**
 * Keys the app cannot give away. Escape closes things, the arrows and Enter
 * drive every list, and a bare letter that is also a digit would swallow the
 * 1–10 scores on the daily log.
 */
const RESERVED = new Set(['escape', 'enter', 'tab', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'backspace', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])

export type Chord = { mod: boolean; shift: boolean; alt: boolean; key: string }

/** `mod+k` → one chord; `g d` → two, pressed in order. */
export function parseBinding(binding: string): Chord[] {
  const steps = binding.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return steps.map((step) => {
    const parts = step.split('+')
    const key = parts.pop() ?? ''
    return {
      mod: parts.includes('mod'),
      shift: parts.includes('shift'),
      alt: parts.includes('alt'),
      key,
    }
  })
}

export function isChordBinding(binding: string): boolean {
  return parseBinding(binding).length > 1
}

/** The caps to draw, in order. `mod` is left for the view to localise. */
export function bindingKeyCaps(binding: string): string[] {
  return parseBinding(binding).flatMap((chord) => {
    const caps: string[] = []
    if (chord.mod) caps.push('mod')
    if (chord.alt) caps.push('alt')
    if (chord.shift) caps.push('shift')
    caps.push(chord.key)
    return caps
  })
}

const EVENT_KEY_ALIASES: Record<string, string> = { ' ': 'space', spacebar: 'space' }

/**
 * What a keyboard handler actually receives.
 *
 * `key` is typed loosely on purpose. The DOM says it is always a string, but
 * these functions run inside a window-level `keydown` listener, which also
 * receives whatever a password manager, a browser extension or an automation
 * tool dispatches — and a plain `new Event('keydown')` carries no `key` at
 * all. There, a throw does not lose a keystroke, it takes the page down.
 */
export type KeyEventLike = {
  key?: unknown
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
}

/** The pressed key as a binding step's name, or null when the event has none. */
function eventKey(event: KeyEventLike): string | null {
  if (typeof event.key !== 'string' || event.key.length === 0) return null
  const raw = event.key.toLowerCase()
  return EVENT_KEY_ALIASES[raw] ?? raw
}

/** What the user just pressed, as a binding step — or null if it cannot be one. */
export function chordFromEvent(event: KeyEventLike): string | null {
  const key = eventKey(event)
  if (key === null || ['meta', 'control', 'shift', 'alt'].includes(key)) return null

  const mod = event.metaKey || event.ctrlKey
  // A reserved key can still be bound once a modifier makes it unambiguous.
  if (!mod && RESERVED.has(key)) return null

  const parts: string[] = []
  if (mod) parts.push('mod')
  if (event.altKey) parts.push('alt')
  // Shift is implied by the character it produced (? is already shift+/).
  if (event.shiftKey && key.length > 1) parts.push('shift')
  parts.push(key)
  return parts.join('+')
}

export function chordMatches(chord: Chord, event: KeyEventLike): boolean {
  const key = eventKey(event)
  if (key === null) return false

  const mod = event.metaKey || event.ctrlKey

  if (key !== chord.key) return false
  if (chord.mod !== mod) return false
  if (chord.alt !== event.altKey) return false
  if (chord.shift && !event.shiftKey) return false
  return true
}

/** Stored bindings win over defaults; an unknown id is ignored, not trusted. */
export function resolveBindings(stored: Bindings | null | undefined): Bindings {
  const resolved = { ...DEFAULT_BINDINGS }
  for (const [id, binding] of Object.entries(stored ?? {})) {
    if (id in resolved && typeof binding === 'string' && binding.trim().length > 0) {
      resolved[id] = binding.trim().toLowerCase()
    }
  }
  return resolved
}

/**
 * Two actions on one binding means one of them never fires. A chord and its
 * own leader clash too: `g` alone would swallow `g d` before it finished.
 */
export function conflictsWith(bindings: Bindings, id: string, binding: string): string[] {
  const candidate = parseBinding(binding)
  const first = candidate[0]
  if (!first) return []

  return Object.entries(bindings)
    .filter(([otherId]) => otherId !== id)
    .filter(([, other]) => {
      const steps = parseBinding(other)
      const head = steps[0]
      if (!head) return false
      if (!sameChord(head, first)) return false
      // Same first key: a clash unless both continue and diverge.
      if (steps.length === 1 || candidate.length === 1) return true
      return sameChord(steps[1] as Chord, candidate[1] as Chord)
    })
    .map(([otherId]) => otherId)
}

const sameChord = (a: Chord, b: Chord) =>
  a.key === b.key && a.mod === b.mod && a.shift === b.shift && a.alt === b.alt

export function isValidBinding(binding: string): boolean {
  const steps = parseBinding(binding)
  if (steps.length === 0 || steps.length > 2) return false
  return steps.every((step) => step.key.length > 0)
}
