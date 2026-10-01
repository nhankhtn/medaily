'use client'

import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '@/lib/utils'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverClose = PopoverPrimitive.Close

/**
 * A panel anchored to the thing that opened it.
 *
 * The difference from a dialog is not size, it is whether the rest of the page
 * has to stop. A dialog dims the page and takes the keyboard because it is
 * asking something; this stays beside its trigger and closes on the next click
 * elsewhere, which is what a handful of controls about the thing on screen
 * wants.
 *
 * `z-60` for the same reason the slash menu carries one: this is portalled to
 * `document.body`, where a dialog is mounted at `z-50`, and a popover opened
 * from inside one would otherwise render underneath the panel it belongs to.
 *
 * The width is capped rather than set — a popover that is wider than its
 * contents is a dialog that forgot to dim the page.
 */
export function PopoverContent({
  className,
  align = 'end',
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        // Never wider than the window, and never taller: a long list of
        // members scrolls inside rather than pushing past the screen.
        collisionPadding={12}
        className={cn(
          'glass-strong z-60 max-h-[min(24rem,var(--radix-popover-content-available-height))]',
          'w-[min(18rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain',
          'rounded-2xl p-3 shadow-lg',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}
