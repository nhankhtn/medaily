'use client'

import { Minus, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'

/** Half-hour stepper for sleep: wide targets, no keyboard needed (spec 6.2). */
export function Stepper({
  value,
  onChange,
  name,
  step = 0.5,
  min = 0,
  max = 24,
  suffix,
}: {
  value: number | null
  onChange: (value: number | null) => void
  name: string
  step?: number
  min?: number
  max?: number
  suffix?: string
}) {
  const t = useTranslations('common')
  const round = (n: number) => Math.round(n / step) * step

  const bump = (delta: number) => {
    const base = value ?? 7
    onChange(Math.min(max, Math.max(min, round(base + delta))))
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => bump(-step)}
        aria-label={`${name} -${step}`}
        className="flex size-11 items-center justify-center rounded-[var(--radius)] border border-border-strong text-text-muted hover:bg-surface-2"
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
          className="h-11 w-full rounded-[var(--radius)] border border-border-strong bg-surface px-3 text-center text-base tabular-nums text-text focus:border-accent focus:outline-none"
        />
        {suffix ? (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-text-subtle">
            {suffix}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => bump(step)}
        aria-label={`${name} +${step}`}
        className="flex size-11 items-center justify-center rounded-[var(--radius)] border border-border-strong text-text-muted hover:bg-surface-2"
      >
        <Plus className="size-4" />
      </button>
      {value !== null ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="shrink-0 px-1 text-xs text-text-subtle hover:text-text"
        >
          {t('none')}
        </button>
      ) : null}
    </div>
  )
}
