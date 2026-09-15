'use client'

import { useCallback, useRef, useState } from 'react'

/**
 * Drag-to-reorder for a vertical list, on Pointer Events rather than HTML5
 * drag-and-drop — that API does not fire on touch at all, and this app is used
 * on a phone.
 *
 * The list is hit-tested under the pointer instead of measured, so a row of any
 * height works and nothing has to be told how tall anything is.
 */
export function useReorder({
  ids,
  onCommit,
}: {
  ids: string[]
  onCommit: (ids: string[]) => void
}) {
  const [order, setOrder] = useState(ids)
  const [dragging, setDragging] = useState<string | null>(null)
  const held = useRef<string | null>(null)

  /**
   * The server is the source of truth between drags: a save, a delete or
   * another device replaces the list and the local copy follows it.
   *
   * Compared by content, not identity. `ids` is rebuilt on every render by the
   * caller, so an effect keyed on the array itself would set state on every
   * render and never stop. Adjusting state during render is React's own answer
   * to a prop the state derives from, and it re-renders before anything paints.
   */
  const key = ids.join()
  const [syncedKey, setSyncedKey] = useState(key)
  if (key !== syncedKey && dragging === null) {
    setSyncedKey(key)
    setOrder(ids)
  }

  const start = useCallback((id: string) => (event: React.PointerEvent) => {
    // Stops the page scrolling under a finger that is dragging a row.
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    held.current = id
    setDragging(id)
  }, [])

  const move = useCallback((event: React.PointerEvent) => {
    const id = held.current
    if (id === null) return

    const under = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest('[data-reorder-id]')
      ?.getAttribute('data-reorder-id')

    if (!under || under === id) return

    setOrder((previous) => {
      const from = previous.indexOf(id)
      const to = previous.indexOf(under)
      if (from < 0 || to < 0) return previous
      const next = [...previous]
      next.splice(to, 0, ...next.splice(from, 1))
      return next
    })
  }, [])

  const end = useCallback(() => {
    if (held.current === null) return
    held.current = null
    setDragging(null)
    // Only worth a round trip if it actually moved.
    if (order.join() !== ids.join()) onCommit(order)
  }, [ids, order, onCommit])

  /** Keyboard equivalent, so the order is not reachable by pointer alone. */
  const nudge = useCallback(
    (id: string, direction: -1 | 1) => {
      const from = order.indexOf(id)
      const to = from + direction
      if (from < 0 || to < 0 || to >= order.length) return
      const next = [...order]
      next.splice(to, 0, ...next.splice(from, 1))
      setOrder(next)
      onCommit(next)
    },
    [order, onCommit],
  )

  return { order, dragging, start, move, end, nudge }
}
