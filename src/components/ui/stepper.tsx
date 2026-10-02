'use client'

import { Minus, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { RollingNumber } from '@/components/ui/rolling-number'
import { cn } from '@/lib/utils'

/** Hold to repeat: a pause, then faster and faster down to this floor. */
const HOLD_DELAY_MS = 400
const REPEAT_START_MS = 160
const REPEAT_FLOOR_MS = 50

/**
 * Wide targets, no keyboard needed, long-press to repeat (spec 6.2). The
 * defaults are sleep's: half an hour a step, and `+` on an empty field starts
 * from a night's sleep rather than from zero. Anything counted rather than
 * slept passes its own.
 *
 * Unfocused, the number is drawn as an odometer over the input; focused, the
 * input shows its own text so typing and the caret behave as usual.
 */
export function Stepper({
  value,
  onChange,
  name,
  step = 0.5,
  min = 0,
  max = 24,
  start = 7,
  suffix,
  adornment,
}: {
  value: number | null
  onChange: (value: number | null) => void
  name: string
  step?: number
  min?: number
  max?: number
  /** What `+` counts up from when the field is empty. */
  start?: number
  suffix?: string
  /** Drawn at the left edge inside the field. */
  adornment?: React.ReactNode
}) {
  const t = useTranslations('common')
  const [focused, setFocused] = useState(false)
  const round = (n: number) => Math.round(n / step) * step

  // The repeat timer outlives the render that started it; it reads these.
  const latest = useRef({ value, onChange })
  useEffect(() => {
    latest.current = { value, onChange }
  })

  const bump = (delta: number) => {
    const { value: current, onChange: change } = latest.current
    const next = Math.min(max, Math.max(min, round((current ?? start) + delta)))
    latest.current = { ...latest.current, value: next }
    change(next)
  }

  const hold = useRef<number | null>(null)
  const release = () => {
    if (hold.current !== null) window.clearTimeout(hold.current)
    hold.current = null
  }
  useEffect(() => release, [])

  const press = (delta: number) => {
    bump(delta)
    let interval = REPEAT_START_MS
    const tick = () => {
      bump(delta)
      interval = Math.max(REPEAT_FLOOR_MS, interval * 0.85)
      hold.current = window.setTimeout(tick, interval)
    }
    hold.current = window.setTimeout(tick, HOLD_DELAY_MS)
  }

  const stepButton = (delta: number, icon: React.ReactNode) => (
    <button
      type="button"
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.currentTarget.setPointerCapture(event.pointerId)
        press(delta)
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      // Keyboard activation has no pointer; `detail` is 0 only then.
      onClick={(event) => {
        if (event.detail === 0) bump(delta)
      }}
      onContextMenu={(event) => event.preventDefault()}
      aria-label={`${name} ${delta > 0 ? '+' : ''}${delta}`}
      className="glass-inset text-text-muted hover:bg-inset-hover flex size-10 touch-manipulation items-center justify-center rounded-[var(--radius)] border-border-strong transition-transform select-none active:scale-90 sm:size-11"
    >
      {icon}
    </button>
  )

  const showOdometer = value !== null && !focused

  return (
    <div className="flex items-center gap-2">
      {stepButton(-step, <Minus className="size-4" />)}
      <div className="relative flex-1">
        {adornment ? (
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
            {adornment}
          </span>
        ) : null}
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={value ?? ''}
          aria-label={name}
          placeholder="—"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => {
            const raw = event.target.value
            if (raw === '') return onChange(null)
            const parsed = Number(raw)
            if (Number.isNaN(parsed)) return
            onChange(Math.min(max, Math.max(min, parsed)))
          }}
          className={cn(
            'glass-inset focus:border-accent focus:inset-ring-accent h-10 w-full rounded-[var(--radius)] border-border-strong px-2.5 text-center text-base tabular-nums focus:inset-ring-1 focus:outline-none sm:h-11 sm:px-3',
            showOdometer ? 'text-transparent' : 'text-text',
          )}
        />
        {showOdometer ? (
          <span
            aria-hidden
            className="text-text pointer-events-none absolute inset-0 flex items-center justify-center text-base"
          >
            <RollingNumber value={String(value)} />
          </span>
        ) : null}
        {suffix ? (
          <span className="text-text-subtle pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">
            {suffix}
          </span>
        ) : null}
      </div>
      {stepButton(step, <Plus className="size-4" />)}
      {value !== null ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-text-subtle hover:text-text shrink-0 px-1 text-xs"
        >
          {t('none')}
        </button>
      ) : null}
    </div>
  )
}
