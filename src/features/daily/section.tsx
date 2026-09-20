'use client'

import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Progressive disclosure with a filled/total counter, so the user always knows
 * what is left without opening every section (spec 6.1).
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

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-baseline gap-2">
          <span className="font-semibold">{title}</span>
          <span
            className={cn(
              'text-xs tabular-nums',
              filled === total ? 'text-good' : 'text-text-subtle',
            )}
          >
            {t('filled', { filled, total })}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'text-text-subtle size-4 shrink-0 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open ? (
        <div id={id} className="border-border-base space-y-5 border-t px-4 py-4">
          {children}
        </div>
      ) : null}
    </Card>
  )
}

export function Field({
  label,
  hint,
  help,
  copied,
  off,
  children,
}: {
  label: string
  hint?: React.ReactNode
  help?: string
  /** Highlighted until touched, after a copy-yesterday fill (spec 6.4). */
  copied?: boolean
  /** Turned off in settings, and empty on this day. */
  off?: boolean
  children: React.ReactNode
}) {
  if (off) return null

  return (
    <div
      className={cn(
        '-mx-2 min-w-0 space-y-2 rounded-[var(--radius)] px-2 py-1 transition-colors',
        copied && 'bg-accent-soft/60',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-text text-sm font-medium">{label}</span>
        {hint ? <span className="text-text-subtle text-xs">{hint}</span> : null}
      </div>
      {children}
      {help ? <p className="text-text-subtle text-xs leading-snug">{help}</p> : null}
    </div>
  )
}
