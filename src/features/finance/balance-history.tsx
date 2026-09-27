'use client'

import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartTooltip } from '@/components/charts/chart-tooltip'
import { ACTIVE_DOT_STROKE, CURSOR_STROKE, SERIES_COLORS } from '@/components/charts/theme'
import { useChartMode } from '@/components/charts/use-chart-mode'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { fromISODate, type ISODate } from '@/lib/dates'
import { formatMoney } from '@/lib/format/money'
import { cn } from '@/lib/utils'

export type BalancePoint = { accountId: string; date: ISODate; balance: number }
type Account = { id: string; name: string }

/** Offered ranges, shortest first. The longest is what the server sent. */
const RANGES = [30, 90, 180] as const

/**
 * How much was in the accounts on each day, rather than only today.
 *
 * Every day the server sends is already a closing balance, so filtering is
 * arithmetic on what is in the browser: no refetch when the range or the
 * account changes, and no spinner between a click and an answer.
 */
export function BalanceHistory({
  points,
  accounts,
  currency,
}: {
  points: BalancePoint[]
  accounts: Account[]
  currency: string
}) {
  const t = useTranslations('finance.balanceHistory')
  const locale = useLocale()
  const format = useFormatter()
  const mode = useChartMode()
  // Money rides the same series colour the rest of the app spends on it, which
  // the dataviz palette already validated for both modes.
  const color = SERIES_COLORS[mode].energy
  const [days, setDays] = useState<number>(30)
  const [accountId, setAccountId] = useState<string>('all')

  const series = useMemo(() => {
    const scoped = accountId === 'all' ? points : points.filter((p) => p.accountId === accountId)

    // One row per day. Picking "all" sums the accounts, which is the same
    // arithmetic the cash total above already does.
    const byDate = new Map<string, number>()
    for (const point of scoped) {
      byDate.set(point.date, (byDate.get(point.date) ?? 0) + point.balance)
    }

    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-days)
      .map(([date, balance]) => ({ date, balance }))
  }, [points, accountId, days])

  if (points.length === 0) return null

  const first = series[0]?.balance ?? 0
  const last = series.at(-1)?.balance ?? 0
  const change = last - first

  return (
    <Card>
      <CardHeader
        title={t('title')}
        action={
          <Select
            aria-label={t('account')}
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            className="h-9 w-auto text-base sm:text-sm"
          >
            <option value="all">{t('allAccounts')}</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        }
      />
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-xl font-semibold tabular-nums sm:text-2xl">
            {formatMoney(last, currency, locale)}
          </span>
          <span
            className={cn(
              'text-sm tabular-nums',
              change > 0 ? 'text-good' : change < 0 ? 'text-bad' : 'text-text-subtle',
            )}
          >
            {change > 0 ? '+' : ''}
            {formatMoney(change, currency, locale)}
            <span className="text-text-subtle"> · {t('overDays', { count: series.length })}</span>
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((range) => (
            <button
              key={range}
              type="button"
              aria-pressed={days === range}
              onClick={() => setDays(range)}
              className={cn(
                'h-8 rounded-full px-3 text-xs transition-colors',
                days === range
                  ? 'glass-inset text-text font-medium shadow-sm'
                  : 'text-text-muted hover:text-text',
              )}
            >
              {t('days', { count: range })}
            </button>
          ))}
        </div>

        <div className="h-48 w-full sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="date" hide />
              {/* Money is not a ratio: a balance chart that starts at zero
                  flattens the movement it exists to show. */}
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Tooltip
                cursor={{ stroke: CURSOR_STROKE, strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const point = payload[0]?.payload as
                    { date: ISODate; balance: number } | undefined
                  if (!point) return null
                  return (
                    <ChartTooltip>
                      <div className="text-text-subtle">
                        {format.dateTime(fromISODate(point.date), 'dayMonth')}
                      </div>
                      <div className="text-text font-medium tabular-nums">
                        {formatMoney(point.balance, currency, locale)}
                      </div>
                    </ChartTooltip>
                  )
                }}
              />
              {/* A line, not an area. The axis starts at the lowest balance
                  rather than at zero, so a filled region would measure nothing
                  — and a balance that crosses zero splits the fill into a band
                  that reads as a rendering fault. */}
              <Line
                type="monotone"
                dataKey="balance"
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: ACTIVE_DOT_STROKE }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  )
}
