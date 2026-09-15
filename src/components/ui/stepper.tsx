'use client'

import { Minus, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'

/**
 * Wide targets, no keyboard needed (spec 6.2). The defaults are sleep's: half
 * an hour a step, and `+` on an empty field starts from a night's sleep rather
 * than from zero. Anything counted rather than slept passes its own.
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
}) {
  const t = useTranslations('common')
  const round = (n: number) => Math.round(n / step) * step

  const bump = (delta: number) => {
    const base = value ?? start
    onChange(Math.min(max, Math.max(min, round(base + delta))))
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => bump(-step)}
        aria-label={`${name} -${step}`}
        className="border-border-strong text-text-muted hover:bg-surface-2 flex size-11 items-center justify-center rounded-[var(--radius)] border"
      >
        <Minus className="size-4" />
      </button>
      <div className="relative flex-1">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={value ?? ''}
          aria-label={name}
          placeholder="—"
          onChange={(event) => {
            const raw = event.target.value
            if (raw === '') return onChange(null)
            const parsed = Number(raw)
            if (Number.isNaN(parsed)) return
            onChange(Math.min(max, Math.max(min, parsed)))
          }}
          className="border-border-strong bg-surface text-text focus:border-accent focus:inset-ring-accent h-11 w-full rounded-[var(--radius)] border px-3 text-center text-base tabular-nums focus:inset-ring-1 focus:outline-none"
        />
        {suffix ? (
          <span className="text-text-subtle pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">
            {suffix}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => bump(step)}
        aria-label={`${name} +${step}`}
        className="border-border-strong text-text-muted hover:bg-surface-2 flex size-11 items-center justify-center rounded-[var(--radius)] border"
      >
        <Plus className="size-4" />
      </button>
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
