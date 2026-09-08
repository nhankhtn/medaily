'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const PERIODS = ['weekly', 'monthly', 'yearly'] as const

export function PeriodPicker({
  period,
  currentKey,
  previousKey,
  nextKey,
  label,
}: {
  period: (typeof PERIODS)[number]
  currentKey: string
  previousKey: string
  nextKey: string | null
  label: string
}) {
  const t = useTranslations('reviews')
  const tc = useTranslations('common')
  const router = useRouter()

  const go = (nextPeriod: string, key?: string) =>
    router.push(`/reviews?period=${nextPeriod}${key ? `&key=${key}` : ''}`)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1">
        {PERIODS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={period === option}
            onClick={() => go(option)}
            className={cn(
              'h-9 rounded-full border px-3.5 text-sm font-medium transition-colors',
              period === option
                ? 'border-transparent bg-accent text-accent-text'
                : 'border-border-base bg-surface text-text-muted hover:border-border-strong',
            )}
          >
            {t(option)}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="iconSm"
          aria-label={tc('previous')}
          onClick={() => go(period, previousKey)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-32 text-center text-sm font-medium tabular-nums">{label}</span>
        <Button
          variant="outline"
          size="iconSm"
          aria-label={tc('next')}
          disabled={!nextKey}
          onClick={() => nextKey && go(period, nextKey)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <span className="sr-only">{currentKey}</span>
    </div>
  )
}
