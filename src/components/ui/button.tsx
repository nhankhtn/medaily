'use client'

import { Slot } from '@radix-ui/react-slot'
import * as React from 'react'
import { buttonVariants, type ButtonVariantProps } from '@/components/ui/button-variants'
import { cn } from '@/lib/utils'

export type ButtonProps = React.ComponentProps<'button'> &
  ButtonVariantProps & { asChild?: boolean }

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...(!asChild ? { type: 'button' as const } : null)}
      {...props}
    />
  )
}
