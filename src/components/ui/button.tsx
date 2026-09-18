import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 select-none',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-text hover:bg-accent-hover',
        secondary: 'bg-surface-2 text-text hover:bg-border-base',
        outline: 'border border-border-strong bg-surface text-text hover:bg-surface-2',
        ghost: 'text-text-muted hover:bg-surface-2 hover:text-text',
        danger: 'bg-bad text-white hover:opacity-90',
      },
      /*
       * Compact on a phone, roomier once there is a pointer. A phone screen is
       * mostly chrome and a finger lands accurately on a 40px target; the extra
       * 4px only pushed the thing you came for further down the page. Controls
       * a finger must find rather than read — a drag handle, a row's delete —
       * still take the full 44px at their own call site.
       */
      size: {
        md: 'h-10 px-3.5 text-sm sm:h-11 sm:px-4',
        sm: 'h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm',
        lg: 'h-11 px-5 text-sm sm:h-12 sm:px-6 sm:text-base',
        icon: 'size-10 sm:size-11',
        iconSm: 'size-8 sm:size-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { buttonVariants }
