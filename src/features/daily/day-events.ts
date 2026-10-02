'use client'

import { useEffect, useState } from 'react'
import type { ISODate } from '@/lib/dates'

const EVENT = 'medaily:day-logged'

type Detail = { date: ISODate; logged: boolean }

/** Save, undo and delete say so, so the header moves before the revalidated render lands. */
export function announceDayLogged(date: ISODate, logged: boolean) {
  window.dispatchEvent(new CustomEvent<Detail>(EVENT, { detail: { date, logged } }))
}

/**
 * The server's answer until the form says otherwise. An override, not a copy:
 * the revalidated render already counts the save, and the two must not add up.
 */
export function useDayLogged(date: ISODate, server: boolean): boolean {
  const [override, setOverride] = useState<Detail | null>(null)

  useEffect(() => {
    const onLogged = (event: Event) => {
      const detail = (event as CustomEvent<Detail>).detail
      if (detail?.date === date) setOverride(detail)
    }
    window.addEventListener(EVENT, onLogged)
    return () => window.removeEventListener(EVENT, onLogged)
  }, [date])

  return override?.date === date ? override.logged : server
}

/** Which way the last day change went. Module state: the form remounts per date, past any prop. */
let direction: -1 | 0 | 1 = 0

export function setDayDirection(next: -1 | 0 | 1) {
  direction = next
}

export function peekDayDirection(): -1 | 0 | 1 {
  return direction
}
