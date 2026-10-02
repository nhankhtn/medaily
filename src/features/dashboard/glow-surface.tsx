'use client'

import type * as React from 'react'
import { cn } from '@/lib/utils'

let reducedMotion: MediaQueryList | undefined

/**
 * A tile with a soft light that follows the mouse. Pointer moves write CSS
 * variables straight onto the node, so tracking never re-renders; touch and
 * reduced motion get no light at all.
 */
export function GlowSurface({
  as: Tag = 'div',
  className,
  children,
}: {
  as?: 'div' | 'li'
  className?: string
  children: React.ReactNode
}) {
  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse') return
    reducedMotion ??= window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches) return
    const node = event.currentTarget
    const rect = node.getBoundingClientRect()
    node.style.setProperty('--glow-x', `${event.clientX - rect.left}px`)
    node.style.setProperty('--glow-y', `${event.clientY - rect.top}px`)
  }

  return (
    <Tag
      className={cn('ui-glow relative isolate overflow-hidden', className)}
      onPointerMove={onPointerMove}
    >
      {children}
    </Tag>
  )
}
