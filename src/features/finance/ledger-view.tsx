'use client'

import { useEffect } from 'react'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { DESKTOP_QUERY, VIEWPORT_COOKIE, viewportCookieValue } from '@/lib/viewport'
import type { FinanceData } from '@/server/services/finance'
import { LedgerDesktop } from './ledger-desktop'
import { LedgerMobile } from './ledger-mobile'

/**
 * Picks the layout, and mounts only that one.
 *
 * Rendering both and hiding one with a class would be simpler, and wrong here:
 * each layout drives `useTransactionFeed`, so two of them means two cursors and
 * two calls to `listTransactions` for a single screen.
 *
 * `initialDesktop` is what the last visit measured, read back from a cookie, so
 * the server usually commits to the right one. The first visit on a device has
 * nothing to go on and may correct itself once, on hydration.
 */
export function LedgerView({
  data,
  initialDesktop,
}: {
  data: FinanceData
  initialDesktop: boolean
}) {
  const desktop = useMediaQuery(DESKTOP_QUERY, initialDesktop)

  useEffect(() => {
    // A year: the answer only changes when someone picks up a different device.
    document.cookie = `${VIEWPORT_COOKIE}=${viewportCookieValue(desktop)}; path=/; max-age=31536000; samesite=lax`
  }, [desktop])

  return desktop ? <LedgerDesktop data={data} /> : <LedgerMobile data={data} />
}
