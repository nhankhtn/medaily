'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/**
 * 1–10 as a ten-segment tap bar rather than a drag slider: one tap, no
 * precision required, and keys 1–0 work when focused (spec 6.2).
 */
export function ScaleInput({
  value,
  onChange,
  name,
  tone = 'accent',
}: {
  value: number | null
  onChange: (value: number | null) => void
  name: string
  tone?: 'accent' | 'good'
}) {
  const t = useTranslations('common')
  const toneClass = tone === 'good' ? 'bg-good' : 'bg-accent'

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex flex-1 gap-1"
        role="radiogroup"
        aria-label={name}
        onKeyDown={(event) => {
          const key = event.key
          if (/^[0-9]$/.test(key)) {
            event.preventDefault()
            onChange(key === '0' ? 10 : Number(key))
          }
          if (key === 'Backspace' || key === 'Delete') {
            event.preventDefault()
            onChange(null)
          }
        }}
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const active = value !== null && n <= value
          const selected = value === n
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${name} ${n}`}
              // Tap the current value again to clear it back to "not logged".
              onClick={() => onChange(selected ? null : n)}
              className={cn(
                'h-11 flex-1 rounded-md border text-xs font-medium transition-colors',
                active
                  ? `${toneClass} border-transparent text-accent-text`
                  : 'border-border-base bg-surface-2 text-text-subtle hover:border-border-strong',
                selected && 'ring-2 ring-accent ring-offset-1 ring-offset-surface',
              )}
            >
              {n}
            </button>
          )
        })}
      </div>
      <span className="w-14 shrink-0 text-right text-sm tabular-nums text-text-muted">
        {value === null ? t('notLogged') : `${value}/10`}
      </span>
    </div>
  )
}
