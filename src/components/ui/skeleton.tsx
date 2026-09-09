import { cn } from '@/lib/utils'

/**
 * Placeholder block. The pulse is disabled automatically under
 * `prefers-reduced-motion` by the global stylesheet.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-2', className)} />
}

/**
 * Generic page placeholder, shaped like the pages actually are: a title, a row
 * of stat tiles, then cards. It exists so navigation swaps immediately instead
 * of leaving the reader on the previous page while the server queries.
 */
export function PageSkeleton({ tiles = 4, cards = 2 }: { tiles?: number; cards?: number }) {
  return (
    <div className="space-y-4" role="status" aria-busy="true">
      <span className="sr-only">Loading</span>

      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-28" />
      </div>

      {tiles > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: tiles }, (_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : null}

      {Array.from({ length: cards }, (_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-[var(--radius)] border border-border-base bg-surface p-4"
        >
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  )
}
