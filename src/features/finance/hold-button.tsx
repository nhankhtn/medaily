'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { haptic } from '@/features/daily/celebrate'
import { cn } from '@/lib/utils'

const HOLD_MS = 1200

/**
 * A destructive pill that fires only after being held — by pointer, or by
 * Enter/Space held down. A click with no hold behind it (`detail === 0`, which
 * is what a screen reader's activate sends) falls back to `window.confirm`.
 */
export function HoldButton({
  onConfirm,
  confirmText,
  hint,
  holding: holdingLabel,
  children,
  className,
  disabled,
  ...props
}: Omit<ButtonProps, 'onClick' | 'asChild'> & {
  onConfirm: () => void
  /** What the fallback dialog asks. */
  confirmText: string
  /** Shown for a moment after a tap that was too short. */
  hint: string
  /** Shown while held. */
  holding: string
  children: ReactNode
}) {
  const [state, setState] = useState<'idle' | 'holding' | 'hint'>('idle')
  const timer = useRef<number | null>(null)
  const hintTimer = useRef<number | null>(null)

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }

  useEffect(
    () => () => {
      clear()
      if (hintTimer.current !== null) window.clearTimeout(hintTimer.current)
    },
    [],
  )

  const start = () => {
    if (disabled || timer.current !== null) return
    haptic(8)
    setState('holding')
    timer.current = window.setTimeout(() => {
      timer.current = null
      setState('idle')
      haptic(24)
      onConfirm()
    }, HOLD_MS)
  }

  const cancel = () => {
    if (timer.current === null) return
    clear()
    setState('hint')
    if (hintTimer.current !== null) window.clearTimeout(hintTimer.current)
    hintTimer.current = window.setTimeout(() => setState('idle'), 1600)
  }

  const isHoldKey = (key: string) => key === 'Enter' || key === ' '

  return (
    <Button
      {...props}
      disabled={disabled}
      data-holding={state === 'holding'}
      style={{ '--hold-ms': `${HOLD_MS}ms` } as CSSProperties}
      className={cn('relative touch-none overflow-hidden select-none', className)}
      onPointerDown={(event) => {
        if (event.button === 0) start()
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (!isHoldKey(event.key)) return
        // Also stops the native click that Enter would fire.
        event.preventDefault()
        if (!event.repeat) start()
      }}
      onKeyUp={(event) => {
        if (!isHoldKey(event.key)) return
        event.preventDefault()
        cancel()
      }}
      onBlur={cancel}
      onClick={(event) => {
        if (event.detail !== 0) return
        if (window.confirm(confirmText)) onConfirm()
      }}
    >
      <span aria-hidden className="fin-hold-fill" />
      <span className="relative inline-flex items-center gap-2">
        {state === 'idle' ? children : state === 'holding' ? holdingLabel : hint}
      </span>
    </Button>
  )
}
