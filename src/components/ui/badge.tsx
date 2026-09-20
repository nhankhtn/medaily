import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'glass text-text-muted',
        accent: 'border border-border-base bg-accent-soft text-accent backdrop-blur-sm',
        good: 'border border-border-base bg-good-soft text-good backdrop-blur-sm',
        warn: 'border border-border-base bg-warn-soft text-warn backdrop-blur-sm',
        bad: 'border border-border-base bg-bad-soft text-bad backdrop-blur-sm',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
