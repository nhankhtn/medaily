'use client'

import { useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export type SegmentedOption<T extends string> = {
  value: T
  label: React.ReactNode
  /** Spoken name, when `label` is an icon. */
  ariaLabel?: string
  title?: string
}

/** Below this the pointer is a tap, not a drag. */
const DRAG_PX = 4

/**
 * A pill of options with a thumb that slides to the chosen one — and can be
 * dragged there. Tapping, dragging and the arrow keys all end in `onChange`;
 * `origin` is the segment it landed on, for effects that start from it.
 */
export function SegmentedSwitch<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
  leading,
  className,
  itemClassName,
}: {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T, origin: HTMLElement) => void
  ariaLabel: string
  disabled?: boolean
  /** Drawn before the first segment, outside the thumb's track. */
  leading?: React.ReactNode
  className?: string
  itemClassName?: string
}) {
  const track = useRef<HTMLDivElement>(null)
  const thumb = useRef<HTMLSpanElement>(null)
  const placed = useRef(false)
  const drag = useRef<{
    pointerId: number
    startX: number
    thumbX: number
    moved: boolean
    over: T
  } | null>(null)
  // A drag ends with a click on whatever was under the finger; that click is not a choice.
  const swallowClick = useRef(false)

  const segments = () =>
    Array.from(track.current?.querySelectorAll<HTMLElement>('[data-segment]') ?? [])

  const segmentOf = (option: T) => segments().find((node) => node.dataset.segment === option)

  /** The thumb is moved on the DOM: a re-render per pointer move would be the whole switch. */
  const moveThumb = (x: number, width: number, animate: boolean) => {
    const node = thumb.current
    if (!node) return
    node.style.transition = animate ? '' : 'none'
    node.style.width = `${width}px`
    node.style.transform = `translateX(${x}px)`
  }

  const settleOn = (option: T, animate = true) => {
    const segment = segmentOf(option)
    if (segment) moveThumb(segment.offsetLeft, segment.offsetWidth, animate)
  }

  useLayoutEffect(() => {
    settleOn(value, placed.current)
    if (!placed.current && thumb.current) {
      void thumb.current.offsetWidth
      thumb.current.style.transition = ''
      placed.current = true
    }
    // Labels change width with the locale; follow them.
    const observer = new ResizeObserver(() => settleOn(value, false))
    if (track.current) observer.observe(track.current)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settleOn reads refs only
  }, [value, options])

  const nearest = (centre: number): HTMLElement | undefined =>
    segments().reduce<HTMLElement | undefined>((best, node) => {
      const distance = Math.abs(node.offsetLeft + node.offsetWidth / 2 - centre)
      if (!best) return node
      const bestDistance = Math.abs(best.offsetLeft + best.offsetWidth / 2 - centre)
      return distance < bestDistance ? node : best
    }, undefined)

  const markOver = (option: T | null) => {
    for (const node of segments()) {
      if (option === null) delete node.dataset.over
      else node.dataset.over = String(node.dataset.segment === option)
    }
  }

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return
    const current = segmentOf(value)
    if (!current) return
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      thumbX: current.offsetLeft,
      moved: false,
      over: value,
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state || state.pointerId !== event.pointerId) return
    const dx = event.clientX - state.startX
    if (!state.moved) {
      if (Math.abs(dx) < DRAG_PX) return
      state.moved = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    const all = segments()
    const first = all[0]
    const last = all.at(-1)
    const current = segmentOf(value)
    if (!first || !last || !current) return
    const width = current.offsetWidth
    const x = Math.min(
      Math.max(state.thumbX + dx, first.offsetLeft),
      last.offsetLeft + last.offsetWidth - width,
    )
    moveThumb(x, width, false)
    const over = nearest(x + width / 2)?.dataset.segment as T | undefined
    if (over && over !== state.over) {
      state.over = over
      markOver(over)
      if ('vibrate' in navigator) navigator.vibrate(4)
    }
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const state = drag.current
    if (!state || state.pointerId !== event.pointerId) return
    drag.current = null
    if (!state.moved) return
    swallowClick.current = true
    // Reset after this event loop turn, so a drag that produced no click cannot eat the next tap.
    window.setTimeout(() => (swallowClick.current = false), 0)
    markOver(null)
    const target = segmentOf(state.over)
    if (cancelled || state.over === value || !target) {
      settleOn(value)
      return
    }
    settleOn(state.over)
    onChange(state.over, target)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0
    if (step === 0 || disabled) return
    event.preventDefault()
    const index = options.findIndex((option) => option.value === value)
    const next = options[(index + step + options.length) % options.length]
    const target = next ? segmentOf(next.value) : undefined
    if (!next || !target) return
    target.focus()
    onChange(next.value, target)
  }

  return (
    <div
      className={cn('glass flex items-center gap-0.5 rounded-full p-0.5', className)}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
    >
      {leading}
      <div
        ref={track}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => endDrag(event, false)}
        onPointerCancel={(event) => endDrag(event, true)}
        onKeyDown={onKeyDown}
        className="relative flex touch-none items-center gap-0.5 select-none"
      >
        <span
          ref={thumb}
          aria-hidden
          className="bg-surface pointer-events-none absolute inset-y-0 left-0 rounded-full shadow-[var(--shadow-card)] transition-[transform,width] duration-300 ease-[var(--ease-spring)]"
        />
        {options.map((option) => {
          const checked = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={option.ariaLabel}
              title={option.title}
              tabIndex={checked ? 0 : -1}
              disabled={disabled}
              data-segment={option.value}
              onClick={(event) => {
                if (swallowClick.current) return
                if (!checked) onChange(option.value, event.currentTarget)
              }}
              className={cn(
                'relative z-[1] flex items-center justify-center rounded-full transition-colors',
                checked ? 'text-text' : 'text-text-subtle hover:text-text',
                // While dragging, the segment under the thumb takes the strong colour.
                'data-[over=true]:text-text data-[over=false]:text-text-subtle',
                itemClassName,
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
