import { Card } from '@/components/ui/card'
import type { DayScore, PeriodScore } from '@/lib/scoring'
import { getTranslations } from 'next-intl/server'

/**
 * Day and week totals only. The component arithmetic stays in the scorer; the
 * home page no longer expands it into a table.
 */
export async function ScoreCard({
  dayScore,
  weekScore,
}: {
  dayScore: DayScore | null
  weekScore: PeriodScore
}) {
  const t = await getTranslations('score')
  const day = dayScore?.score ?? null

  return (
    <Card>
      <div className="divide-border-base flex items-stretch divide-x">
        <div className="flex-1 px-4 py-3">
          <p className="text-text-muted text-xs">{t('dayScore')}</p>
          <p className="text-3xl font-semibold tabular-nums">
            {day === null ? <span className="text-text-subtle">—</span> : Math.round(day)}
          </p>
          {dayScore && dayScore.componentsUsed > 0 ? (
            <p className="text-text-subtle mt-0.5 text-xs">
              {t('componentsUsed', {
                used: dayScore.componentsUsed,
                total: dayScore.components.length,
              })}
            </p>
          ) : null}
        </div>

        <div className="flex-1 px-4 py-3">
          <p className="text-text-muted text-xs">{t('weekScore')}</p>
          <p className="text-3xl font-semibold tabular-nums">
            {weekScore.score === null ? (
              <span className="text-text-subtle text-base font-normal">{t('notEnoughData')}</span>
            ) : (
              Math.round(weekScore.score)
            )}
          </p>
          <p className="text-text-subtle mt-0.5 text-xs">
            {t('coverage', { logged: weekScore.daysLogged, total: weekScore.daysInPeriod })}
          </p>
        </div>
      </div>
    </Card>
  )
}
