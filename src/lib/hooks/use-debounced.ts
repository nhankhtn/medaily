'use client'

import { useEffect, useState } from 'react'

/**
 * A value that settles instead of following every keystroke.
 *
 * What it buys is not the typing but what hangs off it: a query keyed on this
 * value would otherwise throw away the request in flight and start another on
 * each letter.
 */
export function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return settled
}
