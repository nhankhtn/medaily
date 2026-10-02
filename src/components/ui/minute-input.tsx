'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const PRESETS = [15, 30, 45, 60, 90, 120]

/**
 * Minute entry: numeric keypad, preset chips and a +15 bump, so a typical value
 * is one tap and an unusual one is still typeable (spec 6.2).
 *
 * The chosen preset sits on a pill that slides between chips, `+15` floats off
 * the button that added it, and the 14-day median is offered as a chip that
 * fills the field in one tap (spec 6.4).
 */
export function MinuteInput({
  value,
  onChange,
  name,
  medianHint,
  derived,
  presets = PRESETS,
}: {
  value: number | null
  onChange: (value: number | null) => void
  name: string
  /** 14-day median, shown as a ghost the user can accept (spec 6.4). */
  medianHint?: number | null
  /**
   * Minutes already counted for this metric from somewhere else — a timed
   * session. It is never written into this column, so the field stays empty;
   * showing it here is what stops an empty box reading as "nothing recorded".
   */
  derived?: number | null
  presets?: number[]
}) {
  const t = useTranslations('common')
  const [floats, setFloats] = useState<number[]>([])
  const [solidify, setSolidify] = useState(0)

  const row = useRef<HTMLDivElement>(null)
  const pill = useRef<HTMLSpanElement>(null)
  const placed = useRef(false)

  // The pill is moved straight on the DOM: it is a measurement, not state, and
  // it must land before paint or it visibly starts from the wrong chip.
  useLayoutEffect(() => {
    const track = row.current
    const marker = pill.current
    if (!track || !marker) return
    const chip = track.querySelector<HTMLElement>(`[data-preset="${value}"]`)
    if (!chip) {
      marker.style.opacity = '0'
      return
    }
    if (!placed.current) marker.style.transition = 'none'
    marker.style.opacity = '1'
    marker.style.width = `${chip.offsetWidth}px`
    marker.style.transform = `translateX(${chip.offsetLeft}px)`
    if (!placed.current) {
      // Commit the jump before turning transitions back on.
      void marker.offsetWidth
      marker.style.transition = ''
      placed.current = true
    }
  }, [value, presets])

  const offerMedian = value === null && derived == null && medianHint != null && medianHint > 0

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            key={solidify}
            type="number"
            inputMode="numeric"
            min={0}
            max={1440}
            step={5}
            value={value ?? ''}
            aria-label={name}
            placeholder={String(derived ?? medianHint ?? '—')}
            onChange={(event) => {
              const raw = event.target.value
              if (raw === '') return onChange(null)
              const parsed = Number(raw)
              if (Number.isNaN(parsed)) return
              onChange(Math.min(1440, Math.max(0, Math.round(parsed))))
            }}
            className={cn(
              'glass-inset h-10 w-full rounded-[var(--radius)] border-border-strong pr-12 pl-2.5 sm:h-11 sm:pl-3',
              'text-base tabular-nums text-text focus:border-accent focus:outline-none focus:inset-ring-1 focus:inset-ring-accent',
              // A derived number is a real number, not a suggestion to ignore.
              derived != null && value === null
                ? 'border-accent/40 placeholder:font-medium placeholder:text-accent'
                : 'daily-ghost placeholder:text-text-subtle',
              solidify > 0 && 'daily-solidify',
            )}
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-text-subtle">
            {t('min')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(Math.min(1440, (value ?? 0) + 15))
            setFloats((prev) => [...prev, Date.now()])
          }}
          aria-label={`${name} +15`}
          className="glass-inset relative flex h-10 items-center gap-1 rounded-[var(--radius)] border-border-strong px-2.5 text-sm text-text-muted transition-transform hover:bg-inset-hover active:scale-90 sm:h-11 sm:px-3"
        >
          <Plus className="size-3.5" />
          15
          {floats.map((id) => (
            <span
              key={id}
              aria-hidden
              onAnimationEnd={() => setFloats((prev) => prev.filter((other) => other !== id))}
              className="daily-float text-accent pointer-events-none absolute -top-1 left-1/2 text-xs font-semibold"
            >
              +15
            </span>
          ))}
        </button>
      </div>
      <div ref={row} className="no-scrollbar relative -mx-1 flex gap-1.5 overflow-x-auto px-1">
        <span
          ref={pill}
          aria-hidden
          className="bg-accent pointer-events-none absolute top-0 left-0 h-8 rounded-full opacity-0 transition-[transform,width,opacity] duration-300 ease-[var(--ease-out-soft)]"
        />
        {offerMedian ? (
          <button
            type="button"
            onClick={() => {
              onChange(medianHint)
              setSolidify((n) => n + 1)
            }}
            aria-label={t('useValue', { value: medianHint })}
            className="border-accent/50 text-accent relative h-8 shrink-0 rounded-full border border-dashed px-3 text-xs font-medium transition-transform active:scale-95"
          >
            ≈ {medianHint}
          </button>
        ) : null}
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            data-preset={preset}
            onClick={() => onChange(value === preset ? null : preset)}
            className={cn(
              'relative h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-[color,transform] active:scale-95',
              value === preset
                ? 'border-transparent bg-transparent text-accent-text'
                : 'glass-inset text-text-muted hover:border-border-strong',
            )}
          >
            {preset}
          </button>
        ))}
        {value !== null ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="relative h-8 shrink-0 rounded-full px-3 text-xs text-text-subtle hover:text-text"
          >
            {t('none')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
