'use client'

import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'

/**
 * What the tab should say.
 *
 * Pure, and takes the sentence already translated, so the decision can be
 * asserted without a locale: a name when one person is waiting, a count when
 * several are, and the page's own title when nobody is.
 */
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
 * Says who is waiting, in the one place a person looks while doing something
 * else.
 *
 * The page's own title has to be remembered rather than parsed back out,
 * because this replaces it outright rather than decorating it — once the tab
 * says "Nhân đã nhắn tin cho bạn" there is nothing left in it to recover
 * "Personal OS" from. So the last thing written here is kept, and anything
 * else appearing in the title is taken to be Next writing a new page's name.
 *
 * Watched rather than set once: the title belongs to Next, which rewrites it
 * on every navigation and again when a page's metadata resolves — both after
 * this effect has run. The watch is on `head` rather than the title element,
 * because Next swaps that element rather than editing its text, and an
 * observer pointed at the node goes on watching something that has left the
 * document. The write waits for the next frame so it lands after React has
 * finished with `head` instead of in the middle of it — writing during that
 * left a navigation with no title at all.
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
