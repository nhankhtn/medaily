'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

const PRESETS = [15, 30, 45, 60, 90, 120]

/**
 * Minute entry: numeric keypad, preset chips and a +15 bump, so a typical value
 * is one tap and an unusual one is still typeable (spec 6.2).
 */
export function MinuteInput({
  value,
  onChange,
  name,
  medianHint,
  presets = PRESETS,
}: {
  value: number | null
  onChange: (value: number | null) => void
  name: string
  /** 14-day median, shown as a ghost the user can accept (spec 6.4). */
  medianHint?: number | null
  presets?: number[]
}) {
  const t = useTranslations('common')

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={1440}
            step={5}
            value={value ?? ''}
            aria-label={name}
            placeholder={medianHint != null ? String(medianHint) : '0'}
            onChange={(event) => {
              const raw = event.target.value
              if (raw === '') return onChange(null)
              const parsed = Number(raw)
              if (Number.isNaN(parsed)) return
              onChange(Math.min(1440, Math.max(0, Math.round(parsed))))
            }}
            className={cn(
              'h-11 w-full rounded-[var(--radius)] border border-border-strong bg-surface pr-12 pl-3',
              'text-base tabular-nums text-text placeholder:text-text-subtle focus:border-accent focus:outline-none focus:inset-ring-1 focus:inset-ring-accent',
            )}
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-text-subtle">
            {t('min')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(1440, (value ?? 0) + 15))}
          aria-label={`${name} +15`}
          className="flex h-11 items-center gap-1 rounded-[var(--radius)] border border-border-strong px-3 text-sm text-text-muted hover:bg-surface-2"
        >
          <Plus className="size-3.5" />
          15
        </button>
      </div>
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(value === preset ? null : preset)}
            className={cn(
              'h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors',
              value === preset
                ? 'border-transparent bg-accent text-accent-text'
                : 'border-border-base bg-surface-2 text-text-muted hover:border-border-strong',
            )}
          >
            {preset}
          </button>
        ))}
        {value !== null ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="h-8 shrink-0 rounded-full px-3 text-xs text-text-subtle hover:text-text"
          >
            {t('none')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
