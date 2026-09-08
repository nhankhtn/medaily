'use client'

import { ChevronDown, Info } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import type { DayScore, PeriodScore } from '@/lib/scoring'
import { cn } from '@/lib/utils'

/**
 * Every score is one tap from its own arithmetic: raw input, normalized value,
 * weight and points contributed (spec 19.5). No score is shown without a way to
 * see how it was produced.
 */
export function ScoreCard({
  dayScore,
  weekScore,
}: {
  dayScore: DayScore | null
  weekScore: PeriodScore
}) {
  const t = useTranslations('score')
  const [open, setOpen] = useState(false)

  const day = dayScore?.score ?? null
  const componentsWithData = dayScore?.components.filter((c) => c.value !== null) ?? []

  return (
    <div className="rounded-[var(--radius)] border border-border-base bg-surface">
      <div className="flex items-stretch divide-x divide-border-base">
        <div className="flex-1 px-4 py-3">
          <p className="text-xs text-text-muted">{t('dayScore')}</p>
          <p className="text-3xl font-semibold tabular-nums">
            {day === null ? <span className="text-text-subtle">—</span> : Math.round(day)}
          </p>
          {dayScore && dayScore.componentsUsed > 0 ? (
            <p className="mt-0.5 text-xs text-text-subtle">
              {t('componentsUsed', { used: dayScore.componentsUsed, total: dayScore.components.length })}
            </p>
          ) : null}
        </div>

        <div className="flex-1 px-4 py-3">
          <p className="text-xs text-text-muted">{t('weekScore')}</p>
          <p className="text-3xl font-semibold tabular-nums">
            {weekScore.score === null ? (
              <span className="text-base font-normal text-text-subtle">{t('notEnoughData')}</span>
            ) : (
              Math.round(weekScore.score)
            )}
          </p>
          <p className="mt-0.5 text-xs text-text-subtle">
            {t('coverage', { logged: weekScore.daysLogged, total: weekScore.daysInPeriod })}
          </p>
        </div>
      </div>

      {componentsWithData.length > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-2 border-t border-border-base px-4 py-2 text-xs text-text-muted hover:text-text"
          >
            <span className="flex items-center gap-1.5">
              <Info className="size-3.5" />
              {t('breakdown')}
            </span>
            <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
          </button>

          {open ? (
            <div className="border-t border-border-base px-4 py-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-text-subtle">
                    <th className="pb-1 font-normal">{t('component')}</th>
                    <th className="pb-1 text-right font-normal">{t('normalized')}</th>
                    <th className="pb-1 text-right font-normal">{t('weight')}</th>
                    <th className="pb-1 text-right font-normal">{t('points')}</th>
                  </tr>
                </thead>
                <tbody>
                  {dayScore?.components.map((component) => (
                    <tr key={component.component} className="border-t border-border-base">
                      <td className="py-1.5">
                        <span className={component.value === null ? 'text-text-subtle' : ''}>
                          {t(`components.${component.component}`)}
                        </span>
                        {component.detail.restDayCredit === true ? (
                          <Badge tone="accent" className="ml-1.5">
                            {t('restDayCredit')}
                          </Badge>
                        ) : null}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {component.value === null ? '—' : `${Math.round(component.value * 100)}%`}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-text-subtle">
                        {component.weight}%
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {component.value === null ? '—' : component.points.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs leading-snug text-text-subtle">{t('framing')}</p>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
