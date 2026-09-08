import type * as React from 'react'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

/** One sentence on why the module matters, and exactly one primary action. */
export function EmptyState({
  title,
  body,
  action,
  className,
}: {
  title: string
  body?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius)] border border-dashed border-border-strong bg-surface p-6 text-center',
        className,
      )}
    >
      <p className="font-medium">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-prose text-sm text-text-subtle">{body}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function StatRow({ items }: { items: { label: string; value: string; hint?: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-[var(--radius)] border border-border-base bg-surface px-3 py-2.5"
        >
          <dt className="truncate text-xs text-text-muted">{item.label}</dt>
          <dd className="mt-0.5 text-xl font-semibold tabular-nums">{item.value}</dd>
          {item.hint ? <dd className="text-xs text-text-subtle">{item.hint}</dd> : null}
        </div>
      ))}
    </dl>
  )
}
