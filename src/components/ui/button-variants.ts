import { cva, type VariantProps } from 'class-variance-authority'

/**
 * Shared with Server Components (Link className) and the client Button.
 * Keep this file free of `'use client'` so RSC pages can call it.
 */
export const buttonVariants = cva(
  // Pill / circle like iOS controls — continuous radius, not card corners.
  'inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 select-none',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-text hover:bg-accent-hover',
        secondary: 'glass text-text hover:bg-surface-2',
        outline: 'glass border-border-strong text-text hover:bg-surface-2',
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
        md: 'h-10 px-4 text-sm sm:h-11 sm:px-5',
        sm: 'h-8 px-3 text-xs sm:h-9 sm:px-3.5 sm:text-sm',
        lg: 'h-11 px-5 text-sm sm:h-12 sm:px-6 sm:text-base',
        icon: 'size-10 sm:size-11',
        iconSm: 'size-8 sm:size-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonVariantProps = VariantProps<typeof buttonVariants>
