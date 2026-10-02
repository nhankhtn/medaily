'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { cn } from '@/lib/utils'

/** One face per two steps, so the face changes about as often as the feeling. */
const FACES = ['😵', '😪', '😐', '🙂', '🔥']

const faceOf = (value: number) => FACES[Math.min(FACES.length - 1, Math.floor((value - 1) / 2))]

/**
 * 1–10 as a ten-segment tap bar rather than a drag slider: one tap, no
 * precision required, and keys 1–0 work when focused (spec 6.2).
 *
 * The segments fill as a wave travelling out from the previous value, and the
 * colour deepens with the number, so the bar reads at a glance.
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
  const toneVar = tone === 'good' ? '--good' : '--accent'

  // Where the wave starts: the value before this one.
  const [tracked, setTracked] = useState(value)
  const [from, setFrom] = useState(value ?? 0)
  if (tracked !== value) {
    setFrom(tracked ?? 0)
    setTracked(value)
  }

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
              style={{
                transitionDelay: `${Math.abs(n - from) * 15}ms`,
                // Lower segments a shade lighter; the chosen one at full strength.
                ...(active && !selected && value !== null
                  ? {
                      backgroundColor: `color-mix(in oklch, var(${toneVar}) ${50 + value * 5}%, transparent)`,
                    }
                  : {}),
              }}
              className={cn(
                'h-10 flex-1 rounded-md border text-xs font-medium transition-[background-color,color,transform] duration-200 active:scale-90 sm:h-11',
                active
                  ? `${toneClass} border-transparent text-accent-text`
                  : 'glass-inset text-text-subtle hover:border-border-strong',
                selected && 'ring-2 ring-accent ring-offset-1 ring-offset-surface',
              )}
            >
              {n}
            </button>
          )
        })}
      </div>
      <span className="flex w-16 shrink-0 items-center justify-end gap-1 text-right text-sm tabular-nums text-text-muted">
        {value === null ? (
          t('notLogged')
        ) : (
          <>
            <span key={faceOf(value)} aria-hidden className="daily-pop inline-block">
              {faceOf(value)}
            </span>
            {`${value}/10`}
          </>
        )}
      </span>
    </div>
  )
}
