'use client'

import { createContext, useContext } from 'react'

/**
 * The id of the request that rendered this page.
 *
 * Careful what this means: a server action fired from the page is its **own**
 * request with its own id, and that is the id in the server's log line and in
 * any alert it raised. This one identifies the page load — which is the thing
 * a browser-side error belongs to, and enough to find the session in the log.
 */
const RequestId = createContext<string | null>(null)

export function RequestIdProvider({
  value,
  children,
}: {
  value: string | null
  children: React.ReactNode
}) {
  return <RequestId value={value}>{children}</RequestId>
}

export function useRequestId(): string | null {
  return useContext(RequestId)
}
