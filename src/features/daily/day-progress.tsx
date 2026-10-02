'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/**
 * A hairline over the Save button that fills with the form. Once the
 * essentials are in it says so — the rest is optional, and people should know
 * they can stop there.
 */
export function DayProgress({
  filled,
  total,
  essentialsDone,
}: {
  filled: number
  total: number
  essentialsDone: boolean
}) {
  const t = useTranslations('daily.progress')
  const ratio = total > 0 ? filled / total : 0

  return (
    <div className="space-y-1.5">
      <div className="bg-surface-2 h-1 overflow-hidden rounded-full">
        <div
          className={cn(
            'h-full origin-left rounded-full transition-[transform,background-color] duration-500 ease-[var(--ease-out-soft)]',
            essentialsDone ? 'bg-good' : 'bg-accent',
          )}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
      <p className="text-text-muted flex justify-between gap-2 text-[11px]">
        <span
          key={String(essentialsDone)}
          className={cn(essentialsDone && 'daily-pop text-good inline-block font-medium')}
        >
          {essentialsDone ? t('enough') : t('essentialsLeft')}
        </span>
        <span className="tabular-nums">{t('count', { filled, total })}</span>
      </p>
    </div>
  )
}
