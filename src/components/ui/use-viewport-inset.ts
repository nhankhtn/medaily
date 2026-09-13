'use client'

import { useSyncExternalStore } from 'react'

/**
 * How much of the bottom of the window is covered by something the layout does
 * not know about — on a phone, the on-screen keyboard.
 *
 * A `position: fixed` sheet anchored to `bottom: 0` sits underneath it, which
 * is what makes a form unreachable the moment a field is focused. Chrome takes
 * `interactiveWidget: 'resizes-content'` and shrinks the layout viewport for
 * us; Safari does not, and only moves the visual viewport. Reading it directly
 * covers both.
 */
export function useKeyboardInset(): number {
  return useSyncExternalStore(subscribe, read, () => 0)
}

function read(): number {
  const viewport = typeof window === 'undefined' ? null : window.visualViewport
  if (!viewport) return 0

  const covered = window.innerHeight - (viewport.height + viewport.offsetTop)
  // Rounded, so a sub-pixel wobble does not re-render on every frame.
  return covered > 24 ? Math.round(covered) : 0
}

function subscribe(onChange: () => void): () => void {
  const viewport = window.visualViewport
  if (!viewport) return () => {}

  viewport.addEventListener('resize', onChange)
  viewport.addEventListener('scroll', onChange)
  return () => {
    viewport.removeEventListener('resize', onChange)
    viewport.removeEventListener('scroll', onChange)
  }
}
