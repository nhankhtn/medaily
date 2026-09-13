'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { useKeyboardInset } from './use-viewport-inset'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

/**
 * A sheet on phones, a centred dialog from `sm` up (spec 22.3).
 *
 * The scrolling area is a child of the content, so the title and the close
 * button stay put while a long form scrolls under them.
 *
 * The sheet is also lifted clear of the on-screen keyboard. Without that it
 * keeps its full height below the keyboard, and the fields at the bottom —
 * including the save button — cannot be reached at all.
 */
export function DialogContent({
  title,
  description,
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: string
  description?: string
}) {
  const keyboard = useKeyboardInset()

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl border border-border-strong bg-surface shadow-2xl',
          'max-h-[calc(90dvh-var(--keyboard-inset))] bottom-[var(--keyboard-inset)]',
          'sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:max-h-[85dvh]',
          className,
        )}
        {...props}
        style={{ '--keyboard-inset': `${keyboard}px`, ...props.style } as React.CSSProperties}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-4 pt-4 pb-3">
          <div>
            <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-0.5 text-sm text-text-muted">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-text-subtle hover:bg-surface-2 hover:text-text"
            aria-label="Close"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
