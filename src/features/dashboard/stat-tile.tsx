import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A number with its unit and, when a comparison exists, a delta chip. A tile
 * with no data says so rather than showing 0 (spec 38.5).
 */
export function StatTile({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  /** Whether a rise is good — entertainment inverts it. */
  higherIsBetter = true,
  emptyLabel,
}: {
  label: string
  value: number | null
  unit?: string
  delta?: number | null
  deltaLabel?: string
  higherIsBetter?: boolean
  emptyLabel: string
}) {
  const hasValue = value !== null
  const tone =
    delta === null || delta === undefined || Math.abs(delta) < 0.05
      ? 'flat'
      : (delta > 0) === higherIsBetter
        ? 'good'
        : 'bad'

  const Icon = tone === 'flat' ? Minus : delta && delta > 0 ? ArrowUp : ArrowDown

  return (
    <div className="rounded-[var(--radius)] border border-border-base bg-surface px-3 py-2.5">
      <p className="truncate text-xs text-text-muted">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1">
        <span
          className={cn(
            'text-xl font-semibold tabular-nums',
            hasValue ? 'text-text' : 'text-text-subtle',
          )}
        >
          {hasValue ? formatNumber(value) : '—'}
        </span>
        {hasValue && unit ? <span className="text-xs text-text-subtle">{unit}</span> : null}
      </p>
      {hasValue && delta !== null && delta !== undefined ? (
        <p
          className={cn(
            'mt-1 flex items-center gap-1 text-xs tabular-nums',
            tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-text-subtle',
          )}
        >
          <Icon className="size-3" />
          {formatNumber(Math.abs(delta))}
          {deltaLabel ? <span className="text-text-subtle">{deltaLabel}</span> : null}
        </p>
      ) : !hasValue ? (
        <p className="mt-1 text-xs text-text-subtle">{emptyLabel}</p>
      ) : null}
    </div>
  )
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(1)
}
