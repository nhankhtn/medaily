'use client'

import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'

/** Pure, and already translated, so the decision can be asserted. */
export function tabTitle({
  base,
  count,
  messaged,
}: {
  /** The title the page gave itself. */
  base: string
  count: number
  /** "Nhân đã nhắn tin cho bạn", or null when there is no one name to say. */
  messaged: string | null
}): string {
  if (count <= 0) return base
  return messaged ?? `(${count}) ${base}`
}

/**
 * Says who is waiting, where a person looks while doing something else.
 *
 * This replaces the title rather than decorating it, so the page's own is
 * remembered — anything else appearing is Next naming a new page.
 *
 * Three things learned the hard way: the title belongs to Next, which rewrites
 * it after this effect runs; the observer watches `head`, because Next swaps
 * the title element rather than editing it; and the write waits a frame, or it
 * lands mid-render and leaves a navigation with no title at all.
 */
export function TabTitle({ count, from }: { count: number; from: string | null }) {
  const t = useTranslations('chat')
  const pathname = usePathname()
  const base = useRef('')
  const written = useRef('')

  useEffect(() => {
    const messaged = from ? t('tabMessaged', { name: from }) : null

    const apply = () => {
      const current = document.title
      // Empty means Next has taken its title element out and not yet put the
      // next one in. Writing then puts a title where React is about to work.
      if (current === '') return

      // Anything this component did not write is the page naming itself.
      if (current !== written.current) base.current = current

      const wanted = tabTitle({ base: base.current, count, messaged })
      if (wanted !== current) document.title = wanted
      written.current = wanted
    }

    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(apply)
    }

    apply()
    const observer = new MutationObserver(schedule)
    observer.observe(document.head, { childList: true, characterData: true, subtree: true })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [count, from, pathname, t])

  return null
}
