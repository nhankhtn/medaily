'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Somebody's picture, or the first letter of their name.
 *
 * The fallback is not only for the person who never set a picture. A Google
 * photo URL stops resolving when the account changes it, and an `<img>` that
 * fails leaves a torn-page icon next to a name — so a load error falls back to
 * the same letter rather than showing the browser's idea of a broken file.
 *
 * `alt=""` throughout: the name is always written beside it or carried by the
 * label on whatever this sits in, and a screen reader announcing it twice is
 * noise rather than help.
 */
export function Avatar({
  name,
  src,
  className,
}: {
  /** Only the first letter is drawn, but the whole name is what has one. */
  name: string
  src?: string | null
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  const initial = name.trim().charAt(0).toUpperCase()

  const shape = cn('size-7 shrink-0 rounded-full', className)

  if (!src || broken) {
    return (
      <span
        aria-hidden
        className={cn(
          'bg-surface-2 text-text-muted flex items-center justify-center text-xs font-medium',
          shape,
        )}
      >
        {initial}
      </span>
    )
  }

  return (
    /*
     * A remote avatar of unknown size and unknown host: `next/image` would
     * want a loader and a domain allowlist for every provider somebody might
     * have signed in with, to optimise a 28-pixel square.
     */
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      // The rest of the app sends none either, and a Google avatar URL has no
      // business learning which page it was drawn on.
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={cn('object-cover', shape)}
    />
  )
}
