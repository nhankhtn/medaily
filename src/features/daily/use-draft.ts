'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DailyFormValues } from './types'

export const DRAFT_PREFIX = 'medaily.draft.'
const PREFIX = DRAFT_PREFIX
const DEBOUNCE_MS = 500

type Draft = { values: DailyFormValues; savedAt: number }

/**
 * Spec 6.3 — the draft lives on the device, debounced, and survives refresh,
 * crash and tab loss. Server autosave was rejected: it writes on every tap and
 * makes undo meaningless.
 */
export function useDraft(date: string, serverValues: DailyFormValues) {
  const key = PREFIX + date
  const [restored, setRestored] = useState<DailyFormValues | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return
      const draft = JSON.parse(raw) as Draft
      if (!draft?.values) return
      if (JSON.stringify(draft.values) === JSON.stringify(serverValues)) {
        localStorage.removeItem(key)
        return
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only storage read
      setRestored(draft.values)
    } catch {
      /* private mode or corrupt entry — start clean */
    }
    // Restoring is a mount-time decision; re-running on every keystroke would
    // fight the user's edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const save = useCallback(
    (values: DailyFormValues) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        try {
          localStorage.setItem(key, JSON.stringify({ values, savedAt: Date.now() } satisfies Draft))
        } catch {
          /* storage full or blocked — the form still works */
        }
      }, DEBOUNCE_MS)
    },
    [key],
  )

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
    setRestored(null)
  }, [key])

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  return { restored, save, clear }
}

/** Warns before leaving with unsaved edits (spec 6.3). */
export function useUnsavedGuard(dirty: boolean, message: string) {
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = message
      return message
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty, message])
}

/** Pure, so the sweep below can be tested without a browser. */
export function isDraftKey(key: string): boolean {
  return key.startsWith(DRAFT_PREFIX)
}

/**
 * Drops every day's draft. Called on sign-out.
 *
 * A draft is the daily log someone typed and has not saved — their words,
 * sitting in this browser. Left behind, the next person to sign in and open
 * the same date gets it restored into their own form, because the restore
 * only asks whether the draft differs from the server's values and has no way
 * to know it belonged to somebody else.
 */
export function clearDailyDrafts(): void {
  try {
    // Collected first, removed after: removing during an index walk shifts
    // every key after it down one and the walk then steps over half of them.
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key !== null && isDraftKey(key)) keys.push(key)
    }
    for (const key of keys) localStorage.removeItem(key)
  } catch {
    /* private mode or blocked storage — there is nothing kept to clear */
  }
}
