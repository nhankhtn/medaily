import { RollingNumber } from '@/components/ui/rolling-number'

/**
 * `StatRow`, with the figures rolling to their new value when a save refreshes
 * the page. Same markup, so the overview looks unchanged at rest.
 */
export function FinanceStats({
  items,
}: {
  items: { label: string; value: string; hint?: string }[]
}) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="glass rounded-[var(--radius)] px-3 py-2.5">
          <dt className="text-text-muted truncate text-xs">{item.label}</dt>
          <dd className="mt-0.5 text-xl font-semibold tabular-nums">
            <RollingNumber value={item.value} rollIn />
          </dd>
          {item.hint ? <dd className="text-text-subtle text-xs">{item.hint}</dd> : null}
        </div>
      ))}
    </dl>
  )
}
