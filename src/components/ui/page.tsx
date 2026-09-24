import Link from 'next/link'
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
        'glass rounded-[var(--radius)] border-dashed border-border-strong p-6 text-center',
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
          className="glass rounded-[var(--radius)] px-3 py-2.5"
        >
          <dt className="truncate text-xs text-text-muted">{item.label}</dt>
          <dd className="mt-0.5 text-xl font-semibold tabular-nums">{item.value}</dd>
          {item.hint ? <dd className="text-xs text-text-subtle">{item.hint}</dd> : null}
        </div>
      ))}
    </dl>
  )
}

export type Tab = { key: string; label: string; href: string }

/**
 * The pill row a page switches views with. Links, not buttons: a tab is an
 * address, so it can be bookmarked, opened in a new tab, and come back from
 * the back button already on the right one.
 */
export function TabNav({ tabs, current }: { tabs: Tab[]; current: string }) {
  return (
    <nav className="glass flex w-full rounded-full p-0.5">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === current ? 'page' : undefined}
          className={cn(
            // Four Vietnamese labels do not fit a phone at text-sm, and a label
            // that wraps makes the bar two lines tall for one tab and one for
            // the rest. Smaller and unbroken, so the row keeps its height.
            'flex-1 rounded-full px-2.5 py-1 text-center text-xs whitespace-nowrap transition-colors sm:px-3 sm:text-sm',
            tab.key === current
              ? 'glass-inset font-medium text-text shadow-sm'
              : 'text-text-muted hover:text-text',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
