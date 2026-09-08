'use client'

import { ChevronDown, Info } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { ComparisonView } from '@/server/services/analytics'
import { cn } from '@/lib/utils'

/**
 * Spec 18.3 — a comparison only appears once every gate passes, always with its
 * sample size and always as an association. When a gate fails the card says why
 * instead of showing a number nobody should act on.
 */
export function ComparisonCard({ comparison }: { comparison: ComparisonView }) {
  const t = useTranslations('analytics')
  const [open, setOpen] = useState(false)
  const { result } = comparison

  return (
    <div className="rounded-[var(--radius)] border border-border-base bg-surface p-4">
      <p className="text-sm font-medium">{t(`pairs.${comparison.key}.title`)}</p>

      {result.passed && result.high && result.low ? (
        <>
          <p className="mt-1.5 text-sm leading-snug text-text">
            {t(`pairs.${comparison.key}.statement`, {
              high: format(result.high.mean),
              low: format(result.low.mean),
              threshold: comparison.threshold,
            })}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-subtle">
            <span>n = {result.n}</span>
            {result.pearson !== null ? (
              <span className="tabular-nums">
                {t('correlationLabel', {
                  r: result.pearson.toFixed(2),
                  strength: t(`strength.${result.strength}`),
                })}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              <Info className="size-3" />
              {t('howCalculated')}
              <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
            </button>
          </div>

          {open ? (
            <div className="mt-2 space-y-1.5 rounded-[var(--radius)] bg-surface-2 p-2.5 text-xs leading-snug text-text-muted">
              <p>
                {t('howCalculatedBody', {
                  n: result.n,
                  highN: result.high.n,
                  lowN: result.low.n,
                })}
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-1.5">
          <p className="text-sm text-text-subtle">{t('notEnoughData')}</p>
          <p className="mt-0.5 text-xs text-text-subtle">
            {t(`reasons.${result.reason === 'ok' ? 'too_few_days' : result.reason}`, {
              n: result.n,
            })}
          </p>
        </div>
      )}
    </div>
  )
}

const format = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1))
