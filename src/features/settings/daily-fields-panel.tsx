'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  HIDEABLE_FIELDS,
  METRIC_OF,
  TIMER_FILLS,
  type HideableField,
} from '@/lib/daily/hidden-fields'
import { saveHiddenDailyFields } from '@/server/actions/settings'
import { cn } from '@/lib/utils'

/** How many habits and goals read a metric, so a field can say what it feeds. */
export type MetricUse = Record<string, { habits: number; goals: number }>

/** First N fields stay visible on a phone; the rest sit behind "show more". */
const MOBILE_PREVIEW = 5

/**
 * Which questions the evening form asks. Off is off for the form only — the
 * column, the history and anything already written stay exactly where they
 * are, and a day that has a value in a field shows it whatever this says.
 */
export function DailyFieldsPanel({ hidden, uses }: { hidden: string[]; uses: MetricUse }) {
  const t = useTranslations('settings.dailyFields')
  const td = useTranslations('daily.fields')
  const tc = useTranslations('common')
  const [off, setOff] = useState<string[]>(hidden)
  const [expanded, setExpanded] = useState(false)
  const [pending, startTransition] = useTransition()

  const toggle = (field: HideableField) => {
    const next = off.includes(field) ? off.filter((f) => f !== field) : [...off, field]
    setOff(next)
    startTransition(async () => {
      const result = await saveHiddenDailyFields({ fields: next })
      if (!result.ok) {
        setOff(off)
        toast.error(tc('error'))
      }
    })
  }

  const needsToggle = HIDEABLE_FIELDS.length > MOBILE_PREVIEW

  return (
    <section className="border-border-base bg-surface rounded-[var(--radius)] border p-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">{t('title')}</h2>
        {pending ? <Loader2 className="text-text-subtle size-3.5 animate-spin" /> : null}
      </div>
      <p className="text-text-subtle mt-0.5 mb-3 text-xs leading-snug">{t('help')}</p>

      <ul className="divide-border-base divide-y">
        {HIDEABLE_FIELDS.map((field, index) => {
          const metric = METRIC_OF[field]
          const use = metric ? uses[metric] : undefined
          const bound = (use?.habits ?? 0) + (use?.goals ?? 0)
          const timed = TIMER_FILLS.includes(field)
          const shown = !off.includes(field)

          return (
            <li
              key={field}
              className={cn(
                'flex items-start justify-between gap-3 py-2',
                !expanded && index >= MOBILE_PREVIEW && 'max-sm:hidden',
              )}
            >
              <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={shown}
                  onChange={() => toggle(field)}
                  className="accent-accent mt-0.5 size-4 shrink-0"
                />
                <span className="min-w-0">
                  <span className="text-text block text-sm">{td(labelKey(field))}</span>
                  {/*
                   * Said before the click, not after: a habit bound to a field
                   * you stop answering never ticks again, and nothing else in
                   * the app would tell you why the streak broke.
                   */}
                  {bound > 0 ? (
                    <span className="text-warn block text-xs leading-snug">
                      {t('inUse', { habits: use?.habits ?? 0, goals: use?.goals ?? 0 })}
                    </span>
                  ) : timed ? (
                    <span className="text-text-subtle block text-xs leading-snug">
                      {t('timerFills')}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {needsToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="text-accent mt-2 text-sm font-medium sm:hidden"
        >
          {expanded ? tc('showLess') : tc('showMore')}
        </button>
      ) : null}
    </section>
  )
}

/** The form's own label keys, which do not all match the column name. */
function labelKey(field: HideableField): string {
  switch (field) {
    case 'technicalStudyMinutes':
      return 'technicalStudy'
    case 'deepWorkMinutes':
      return 'deepWork'
    case 'exerciseMinutes':
      return 'exercise'
    case 'readingMinutes':
      return 'reading'
    case 'entertainmentMinutes':
      return 'entertainment'
    case 'englishMinutes':
      return 'english'
    default:
      return field
  }
}
