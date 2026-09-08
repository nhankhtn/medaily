import * as React from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-[var(--radius)] border border-border-strong bg-surface px-3 text-base text-text',
        'placeholder:text-text-subtle focus:border-accent focus:outline-none',
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
        'min-h-20 w-full resize-y rounded-[var(--radius)] border border-border-strong bg-surface px-3 py-2 text-base text-text',
        'placeholder:text-text-subtle focus:border-accent focus:outline-none',
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
      <span className="text-sm font-medium text-text">{children}</span>
      {hint ? <span className="text-xs text-text-subtle">{hint}</span> : null}
    </label>
  )
}
