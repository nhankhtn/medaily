import { describe, expect, it } from 'vitest'
import {
  ACTIONS,
  bindingKeyCaps,
  chordFromEvent,
  chordMatches,
  conflictsWith,
  DEFAULT_BINDINGS,
  isChordBinding,
  isValidBinding,
  parseBinding,
  resolveBindings,
} from '@/lib/shortcuts'

const press = (key: string, mods: Partial<Record<'meta' | 'ctrl' | 'shift' | 'alt', boolean>> = {}) => ({
  key,
  metaKey: mods.meta ?? false,
  ctrlKey: mods.ctrl ?? false,
  shiftKey: mods.shift ?? false,
  altKey: mods.alt ?? false,
})

describe('the registry', () => {
  it('gives every action a unique id and a default binding', () => {
    const ids = ACTIONS.map((action) => action.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ACTIONS.every((action) => action.binding.length > 0)).toBe(true)
  })

  it('ships without a clash, or one of them would never fire', () => {
    for (const action of ACTIONS) {
      expect(conflictsWith(DEFAULT_BINDINGS, action.id, action.binding)).toEqual([])
    }
  })

  it('sends every jump somewhere', () => {
    const jumps = ACTIONS.filter((action) => action.group === 'goto')
    expect(jumps.length).toBeGreaterThan(0)
    expect(jumps.every((action) => action.href?.startsWith('/'))).toBe(true)
  })
})

describe('parsing', () => {
  it('reads a modifier chord', () => {
    expect(parseBinding('mod+k')).toEqual([{ mod: true, shift: false, alt: false, key: 'k' }])
  })

  it('reads a two-key sequence', () => {
    expect(isChordBinding('g d')).toBe(true)
    expect(isChordBinding('mod+k')).toBe(false)
    expect(parseBinding('g d')).toHaveLength(2)
  })

  it('lists the caps in the order they are pressed', () => {
    expect(bindingKeyCaps('mod+k')).toEqual(['mod', 'k'])
    expect(bindingKeyCaps('g d')).toEqual(['g', 'd'])
  })

  it('rejects nonsense and sequences longer than two', () => {
    expect(isValidBinding('')).toBe(false)
    expect(isValidBinding('g d h')).toBe(false)
    expect(isValidBinding('mod+k')).toBe(true)
  })
})

describe('reading a keypress', () => {
  it('turns a press into a binding', () => {
    expect(chordFromEvent(press('k', { meta: true }))).toBe('mod+k')
    expect(chordFromEvent(press('K', { ctrl: true }))).toBe('mod+k')
    expect(chordFromEvent(press('?'))).toBe('?')
    expect(chordFromEvent(press(' '))).toBe('space')
  })

  it('ignores a modifier pressed on its own', () => {
    expect(chordFromEvent(press('Shift'))).toBeNull()
    expect(chordFromEvent(press('Meta'))).toBeNull()
  })

  it('refuses the keys the app cannot give away', () => {
    expect(chordFromEvent(press('Escape'))).toBeNull()
    expect(chordFromEvent(press('Enter'))).toBeNull()
    expect(chordFromEvent(press('ArrowDown'))).toBeNull()
    // A digit alone scores the daily log, so it stays out of reach.
    expect(chordFromEvent(press('3'))).toBeNull()
  })

  it('allows a reserved key once a modifier makes it unambiguous', () => {
    expect(chordFromEvent(press('3', { meta: true }))).toBe('mod+3')
  })
})

describe('matching a keypress', () => {
  const [modK] = parseBinding('mod+k')

  it('fires on the right press', () => {
    expect(chordMatches(modK!, press('k', { meta: true }))).toBe(true)
    expect(chordMatches(modK!, press('k', { ctrl: true }))).toBe(true)
  })

  it('does not fire without the modifier', () => {
    expect(chordMatches(modK!, press('k'))).toBe(false)
  })

  it('does not fire on a different key', () => {
    expect(chordMatches(modK!, press('j', { meta: true }))).toBe(false)
  })

  /**
   * These run in a window-level keydown listener, which also receives events
   * dispatched by password managers and browser extensions — and a plain
   * `new Event('keydown')` has no `key` at all. Reading it blindly threw
   * `Cannot read properties of undefined (reading 'toLowerCase')` and took the
   * page down with it, so an event that cannot name a key must simply not match.
   */
  it('ignores an event carrying no key instead of throwing', () => {
    const mods = { metaKey: true, ctrlKey: false, shiftKey: false, altKey: false }

    expect(chordMatches(modK!, { ...mods })).toBe(false)
    expect(chordMatches(modK!, { ...mods, key: undefined })).toBe(false)
    expect(chordMatches(modK!, { ...mods, key: null })).toBe(false)
    expect(chordMatches(modK!, { ...mods, key: '' })).toBe(false)
    expect(chordMatches(modK!, { ...mods, key: 42 })).toBe(false)

    expect(chordFromEvent({ ...mods })).toBeNull()
    expect(chordFromEvent({ ...mods, key: undefined })).toBeNull()
    expect(chordFromEvent({ ...mods, key: '' })).toBeNull()
  })
})

describe('resolving stored bindings', () => {
  it('falls back to the defaults', () => {
    expect(resolveBindings(null)).toEqual(DEFAULT_BINDINGS)
    expect(resolveBindings({})).toEqual(DEFAULT_BINDINGS)
  })

  it('lets a stored binding win', () => {
    expect(resolveBindings({ save: 'mod+s' }).save).toBe('mod+s')
  })

  it('ignores an id the app does not know', () => {
    const resolved = resolveBindings({ notAnAction: 'x' })
    expect('notAnAction' in resolved).toBe(false)
  })

  it('ignores an empty binding rather than unbinding the action', () => {
    expect(resolveBindings({ save: '   ' }).save).toBe(DEFAULT_BINDINGS.save)
  })
})

describe('conflicts', () => {
  it('names the action already holding the key', () => {
    expect(conflictsWith(DEFAULT_BINDINGS, 'save', 'mod+k')).toEqual(['palette'])
  })

  it('is quiet when the key is free', () => {
    expect(conflictsWith(DEFAULT_BINDINGS, 'save', 'mod+shift+p')).toEqual([])
  })

  it('does not count the action against itself', () => {
    expect(conflictsWith(DEFAULT_BINDINGS, 'palette', 'mod+k')).toEqual([])
  })

  it('catches a leader that would swallow a sequence', () => {
    // `g` alone fires before `g d` can finish.
    expect(conflictsWith(DEFAULT_BINDINGS, 'save', 'g')).toContain('home')
  })

  it('lets two sequences share a leader when they diverge', () => {
    expect(conflictsWith(DEFAULT_BINDINGS, 'save', 'g w')).toEqual([])
  })
})
