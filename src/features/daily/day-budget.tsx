'use client'

import { AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { DailyFormValues } from './types'

const DAY_HOURS = 24
/** Past this the save warns (spec 5.2); drawn as a tick on the bar. */
const BUDGET_HOURS = 20

const SEGMENTS = [
  { key: 'sleep', tint: 'var(--accent)', hours: (v: DailyFormValues) => v.sleepHours ?? 0 },
  {
    key: 'study',
    tint: 'var(--good)',
    hours: (v: DailyFormValues) => (v.technicalStudyMinutes ?? 0) / 60,
  },
  {
    key: 'deepWork',
    tint: 'color-mix(in oklch, var(--good) 55%, var(--accent))',
    hours: (v: DailyFormValues) => (v.deepWorkMinutes ?? 0) / 60,
  },
  {
    key: 'exercise',
    tint: 'var(--warn)',
    hours: (v: DailyFormValues) => (v.exerciseMinutes ?? 0) / 60,
  },
  {
    key: 'reading',
    tint: 'color-mix(in oklch, var(--accent) 45%, var(--warn))',
    hours: (v: DailyFormValues) => (v.readingMinutes ?? 0) / 60,
  },
  {
    key: 'english',
    tint: 'color-mix(in oklch, var(--good) 40%, var(--warn))',
    hours: (v: DailyFormValues) => (v.englishMinutes ?? 0) / 60,
  },
  {
    key: 'entertainment',
    tint: 'var(--text-subtle)',
    hours: (v: DailyFormValues) => (v.entertainmentMinutes ?? 0) / 60,
  },
] as const

const formatHours = (hours: number) => String(Math.round(hours * 10) / 10)

/**
 * Where the day's 24 hours went, filling as the form does. Over 20 the bar
 * says so in place; the save still goes through (spec 5.2).
 */
export function DayBudget({ values }: { values: DailyFormValues }) {
  const t = useTranslations('daily.budget')
  const ts = useTranslations('daily')
  const parts = SEGMENTS.map((segment) => ({ ...segment, value: segment.hours(values) })).filter(
    (part) => part.value > 0,
  )
  const total = parts.reduce((sum, part) => sum + part.value, 0)
  if (total === 0) return null

  const over = total > BUDGET_HOURS
  // Past 24 the bar rescales rather than overflowing its track.
  const scale = Math.max(DAY_HOURS, total)

  return (
    <Card className="space-y-2.5 px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{t('title')}</span>
        <span
          className={cn(
            'text-xs tabular-nums',
            over ? 'text-warn font-semibold' : 'text-text-muted',
          )}
        >
          {t('of', { hours: formatHours(total), day: DAY_HOURS })}
        </span>
      </div>

      <div className="glass-inset relative flex h-2.5 overflow-hidden rounded-full">
        {parts.map((part) => (
          <span
            key={part.key}
            title={`${t(part.key)} · ${formatHours(part.value)}h`}
            className="h-full transition-[flex-grow] duration-500 ease-[var(--ease-out-soft)]"
            style={{ flexGrow: part.value, flexBasis: 0, background: part.tint }}
          />
        ))}
        <span style={{ flexGrow: Math.max(0, scale - total), flexBasis: 0 }} />
        <span
          aria-hidden
          className={cn('absolute inset-y-0 w-0.5', over ? 'bg-warn' : 'bg-border-strong')}
          style={{ left: `${(BUDGET_HOURS / scale) * 100}%` }}
        />
      </div>

      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {parts.map((part) => (
          <li key={part.key} className="text-text-muted flex items-center gap-1 text-[11px]">
            <span aria-hidden className="size-2 rounded-full" style={{ background: part.tint }} />
            {t(part.key)}
            <span className="tabular-nums">{formatHours(part.value)}h</span>
          </li>
        ))}
      </ul>

      {over ? (
        <p className="bg-warn-soft text-warn flex items-start gap-2 rounded-[var(--radius)] p-2.5 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {ts('sanityWarning')}
        </p>
      ) : null}
    </Card>
  )
}
