import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Floating label over a chart — glass-strong so it reads over series lines. */
export function ChartTooltip({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <div className={cn('glass-strong rounded-md px-2 py-1 text-xs', className)}>{children}</div>
}
