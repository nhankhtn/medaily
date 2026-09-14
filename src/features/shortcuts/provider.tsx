'use client'

import { useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import {
  ACTIONS,
  chordMatches,
  DEFAULT_BINDINGS,
  parseBinding,
  type Bindings,
  type Chord,
} from '@/lib/shortcuts'

type Registry = {
  bindings: Bindings
  register: (id: string, handler: () => void) => () => void
}

const ShortcutContext = createContext<Registry>({
  bindings: DEFAULT_BINDINGS,
  register: () => () => {},
})

/** How long a leader key waits for the key that completes it. */
const CHORD_WINDOW_MS = 1500

/**
 * One listener for every shortcut in the app.
 *
 * A single dispatcher is what makes two-key sequences work at all: `g` has to
 * wait to see whether `d` follows, and that decision cannot be made by six
 * components each listening on their own. Handlers register by action id, so a
 * key that is remapped keeps reaching the same code.
 */
export function ShortcutProvider({
  bindings,
  children,
}: {
  bindings: Bindings
  children: React.ReactNode
}) {
  const router = useRouter()
  const handlers = useRef(new Map<string, () => void>())
  const pending = useRef<{ key: string; at: number } | null>(null)

  const register = useCallback((id: string, handler: () => void) => {
    handlers.current.set(id, handler)
    return () => {
      if (handlers.current.get(id) === handler) handlers.current.delete(id)
    }
  }, [])

  useEffect(() => {
    const steps = Object.entries(bindings).map(([id, binding]) => ({
      id,
      chords: parseBinding(binding),
    }))

    const fire = (id: string) => {
      const handler = handlers.current.get(id)
      if (handler) {
        handler()
        return true
      }
      // Nothing mounted owns it; a jump is the provider's own to make.
      const href = ACTIONS.find((action) => action.id === id)?.href
      if (href) {
        router.push(href)
        return true
      }
      return false
    }

    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = Boolean(target?.closest('input, textarea, select, [contenteditable]'))

      const expired = pending.current && Date.now() - pending.current.at > CHORD_WINDOW_MS
      const leader = expired ? null : pending.current
      pending.current = null

      // Finish a sequence that was already started.
      if (leader) {
        const match = steps.find(
          (step) =>
            step.chords.length === 2 &&
            step.chords[0]?.key === leader.key &&
            chordMatches(step.chords[1] as Chord, event),
        )
        if (match) {
          event.preventDefault()
          fire(match.id)
          return
        }
      }

      for (const step of steps) {
        const first = step.chords[0]
        if (!first || !chordMatches(first, event)) continue

        // A bare key belongs to whatever the user is typing into; one held
        // with a modifier does not, so ⌘K still opens the palette mid-sentence.
        if (typing && !first.mod) continue

        if (step.chords.length === 1) {
          if (fire(step.id)) event.preventDefault()
          return
        }

        event.preventDefault()
        pending.current = { key: first.key, at: Date.now() }
        return
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bindings, router])

  const value = useMemo(() => ({ bindings, register }), [bindings, register])

  return <ShortcutContext.Provider value={value}>{children}</ShortcutContext.Provider>
}

/**
 * Runs `handler` when the key bound to `id` is pressed, wherever that key has
 * been remapped to. Only the mounted page's handler fires, so `s` saves the
 * daily log and does nothing anywhere else.
 */
export function useShortcut(id: string, handler: () => void, enabled = true): void {
  const { register } = useContext(ShortcutContext)
  const latest = useRef(handler)

  useEffect(() => {
    latest.current = handler
  })

  useEffect(() => {
    if (!enabled) return
    return register(id, () => latest.current())
  }, [id, enabled, register])
}

export function useBindings(): Bindings {
  return useContext(ShortcutContext).bindings
}
