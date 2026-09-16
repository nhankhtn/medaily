import * as React from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'border-border-strong bg-surface text-text h-11 w-full rounded-[var(--radius)] border px-3 text-base',
        'placeholder:text-text-subtle focus:border-accent focus:inset-ring-accent focus:inset-ring-1 focus:outline-none',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'border-border-strong bg-surface text-text min-h-20 w-full resize-y rounded-[var(--radius)] border px-3 py-2 text-base',
        'placeholder:text-text-subtle focus:border-accent focus:inset-ring-accent focus:inset-ring-1 focus:outline-none',
        // Grows with what is typed, so a list is not written through a
        // two-line slit. Browsers without it keep the scrollbar they had.
        '[field-sizing:content]',
        className,
      )}
      {...props}
    />
  )
}

export function Label({
  className,
  hint,
  children,
  ...props
}: React.ComponentProps<'label'> & { hint?: React.ReactNode }) {
  return (
    <label className={cn('flex items-baseline justify-between gap-2', className)} {...props}>
      <span className="text-text text-sm font-medium">{children}</span>
      {hint ? <span className="text-text-subtle text-xs">{hint}</span> : null}
    </label>
  )
}
