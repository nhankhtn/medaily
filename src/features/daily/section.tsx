'use client'

import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Progressive disclosure with a filled/total counter, so the user always knows
 * what is left without opening every section (spec 6.1). The counter is a ring
 * that closes as the section fills, and becomes a tick once it is full.
 */
export function FormSection({
  title,
  filled,
  total,
  defaultOpen = true,
  children,
}: {
  title: string
  filled: number
  total: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const t = useTranslations('daily.sections')
  const id = useId()
  const complete = total > 0 && filled === total

  // Bounce once, on the edit that completes it — not on a page that opens full.
  const [wasComplete, setWasComplete] = useState(complete)
  const [cheer, setCheer] = useState(0)
  if (wasComplete !== complete) {
    setWasComplete(complete)
    if (complete) setCheer((n) => n + 1)
  }

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="font-semibold">{title}</span>
          <span
            key={cheer}
            className={cn(
              'flex items-center gap-1 text-xs tabular-nums',
              complete ? 'text-good' : 'text-text-subtle',
              cheer > 0 && 'daily-bounce',
            )}
          >
            <ProgressRing filled={filled} total={total} />
            {t('filled', { filled, total })}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'text-text-subtle size-4 shrink-0 transition-transform duration-300',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? (
        <div id={id} className="daily-reveal border-border-base space-y-5 border-t px-4 py-4">
          {children}
        </div>
      ) : null}
    </Card>
  )
}

function ProgressRing({ filled, total }: { filled: number; total: number }) {
  const ratio = total > 0 ? filled / total : 0
  const complete = total > 0 && filled === total

  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
      <circle
        cx="8"
        cy="8"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="2"
      />
      <circle
        cx="8"
        cy="8"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - ratio}
        transform="rotate(-90 8 8)"
        className="daily-ring"
      />
      {complete ? (
        <path
          d="M5 8.3 7.2 10.5 11 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="daily-tick"
        />
      ) : null}
    </svg>
  )
}

export function Field({
  label,
  hint,
  help,
  copied,
  copyIndex = 0,
  badge,
  off,
  children,
}: {
  label: string
  hint?: React.ReactNode
  help?: string
  /** Highlighted until touched, after a copy-yesterday fill (spec 6.4). */
  copied?: boolean
  /** Order among the copied fields, so they take their values one by one. */
  copyIndex?: number
  /** Beside the label: a live timer feeding this field, for one. */
  badge?: React.ReactNode
  /** Turned off in settings, and empty on this day. */
  off?: boolean
  children: React.ReactNode
}) {
  const t = useTranslations('daily')
  if (off) return null

  return (
    <div
      style={{ '--i': copyIndex } as React.CSSProperties}
      className={cn(
        '-mx-2 min-w-0 space-y-2 rounded-[var(--radius)] border border-transparent px-2 py-1 transition-colors',
        copied && 'daily-copy-in border-accent/50 bg-accent-soft/60 border-dashed',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="text-text text-sm font-medium">{label}</span>
          {copied ? (
            <span className="daily-pop bg-accent text-accent-text inline-block rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium">
              {t('copiedTag')}
            </span>
          ) : null}
          {badge}
        </span>
        {hint ? <span className="text-text-subtle text-xs">{hint}</span> : null}
      </div>
      {children}
      {help ? <p className="text-text-subtle text-xs leading-snug">{help}</p> : null}
    </div>
  )
}
