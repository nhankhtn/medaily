import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * A placeholder block with a diagonal sweep. `glass` is for a block standing
 * in for a whole level-1 tile; inside a card leave it off, so the fill is the
 * inset one and nothing blurs twice. `index` staggers the sweep into a wave.
 */
export function Shimmer({
  className,
  glass = false,
  index = 0,
}: {
  className?: string
  glass?: boolean
  index?: number
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'ui-shimmer relative overflow-hidden',
        glass ? 'glass rounded-[var(--radius)]' : 'bg-inset rounded-md',
        className,
      )}
      style={{ '--i': index } as React.CSSProperties}
    />
  )
}

/** The panel a group of shimmer blocks sits in — a card without content. */
export function ShimmerCard({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn('glass rounded-[var(--radius)] p-4', className)}>{children}</div>
}

/** Wraps a whole route placeholder, so assistive tech hears one "loading". */
export function LoadingRegion({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('space-y-4', className)} role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

type CardShape = 'rows' | 'chart' | 'text'

/**
 * Header, optional tab pill, optional tile row, then cards — the order every
 * module page is built in, so the swap to real content barely moves anything.
 */
export function PageShimmer({
  label,
  subtitle = true,
  action = true,
  tabs = 0,
  tiles = 0,
  cards = ['rows', 'rows'],
  columns = 1,
}: {
  label: string
  subtitle?: boolean
  action?: boolean
  tabs?: number
  tiles?: number
  cards?: CardShape[]
  columns?: 1 | 2 | 3
}) {
  return (
    <LoadingRegion label={label}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Shimmer className="h-8 w-40" />
          {subtitle ? <Shimmer className="h-4 w-56 max-w-[60vw]" index={1} /> : null}
        </div>
        {action ? <Shimmer className="h-8 w-24 rounded-full sm:h-9" index={1} /> : null}
      </div>

      {tabs > 0 ? (
        <div className="glass flex w-full gap-1 rounded-full p-0.5 sm:w-fit">
          {Array.from({ length: tabs }, (_, i) => (
            <Shimmer key={i} className="h-7 flex-1 rounded-full sm:w-24 sm:flex-none" index={i} />
          ))}
        </div>
      ) : null}

      {tiles > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: tiles }, (_, i) => (
            <Shimmer key={i} glass className="h-[4.25rem]" index={i} />
          ))}
        </div>
      ) : null}

      <div
        className={cn(
          'grid gap-4',
          columns === 2 && 'sm:grid-cols-2',
          columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        )}
      >
        {cards.map((shape, i) => (
          <ShimmerCard key={i} className="space-y-3">
            <Shimmer className="h-3.5 w-28" index={i} />
            <CardShapeBody shape={shape} index={i} />
          </ShimmerCard>
        ))}
      </div>
    </LoadingRegion>
  )
}

function CardShapeBody({ shape, index }: { shape: CardShape; index: number }) {
  if (shape === 'chart') return <Shimmer className="h-40 w-full" index={index + 1} />

  if (shape === 'text') {
    return (
      <>
        <Shimmer className="h-3 w-full" index={index + 1} />
        <Shimmer className="h-3 w-11/12" index={index + 2} />
        <Shimmer className="h-3 w-3/5" index={index + 3} />
      </>
    )
  }

  return (
    <ul className="space-y-2.5">
      {[0, 1, 2].map((row) => (
        <li key={row} className="flex items-center gap-3">
          <Shimmer className="size-8 shrink-0 rounded-full" index={index + row} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Shimmer className={cn('h-3', row === 1 ? 'w-2/3' : 'w-4/5')} index={index + row} />
            <Shimmer className="h-2.5 w-1/3" index={index + row + 1} />
          </div>
        </li>
      ))}
    </ul>
  )
}
