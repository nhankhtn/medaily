import * as React from 'react'
import { DateInput } from '@/components/ui/date-input'
import { cn } from '@/lib/utils'

export function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  // Safari paints `type="date"` in the OS locale (long Vietnamese on iPhone).
  // Route it through DateInput so the visible string is always dd/mm/yyyy.
  if (type === 'date') {
    return <DateInput className={className} {...props} />
  }

  return (
    <input
      type={type}
      className={cn(
        // 16px on every viewport: Safari zooms the page when a focused field
        // is smaller, including landscape phones past the `sm` breakpoint.
        'glass text-text h-10 w-full rounded-[var(--radius)] border-border-strong px-2.5 text-base sm:h-11 sm:px-3',
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
        'glass text-text min-h-18 w-full resize-y rounded-[var(--radius)] border-border-strong px-2.5 py-2 text-base sm:min-h-20 sm:px-3',
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
