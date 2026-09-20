import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * A native select. On mobile it opens the platform picker, which is faster and
 * more accessible than any custom listbox — and this app is mobile-first.
 */
export function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'glass text-text h-10 w-full rounded-[var(--radius)] border-border-strong px-2.5 text-base sm:h-11 sm:px-3',
        'focus:border-accent focus:outline-none focus:inset-ring-1 focus:inset-ring-accent',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}
