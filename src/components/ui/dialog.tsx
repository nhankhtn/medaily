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
 * A sheet on phones; from `sm` up either a centred dialog or a side drawer.
 *
 * The scrolling area is a child of the content, so the title and the close
 * button stay put while a long form scrolls under them.
 *
 * The sheet is also lifted clear of the on-screen keyboard. Without that it
 * keeps its full height below the keyboard, and the fields at the bottom —
 * including the save button — cannot be reached at all.
 *
 * `layout="drawer"` is for long writing (notes, journal): nearly full height
 * on a phone, a wide side panel on desktop, so the body field has room to grow.
 *
 * `layout` is geometry and nothing else. Who does the scrolling is `body`,
 * because the two are not the same question: a drawer holding a list wants the
 * panel to scroll, and a drawer holding an editor wants the editor to. Deciding
 * the second from the first is how a long list ended up clipped with no way to
 * reach the bottom of it.
 */
export function DialogContent({
  title,
  description,
  layout = 'dialog',
  body = 'scroll',
  headerAction,
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: string
  description?: string
  /**
   * `dialog` is a centred box for a short form. `drawer` is the side panel a
   * record is read and edited in. `full` is the same panel given the screen,
   * for the one thing a side panel is bad at: writing something long.
   */
  layout?: 'dialog' | 'drawer' | 'full'
  /**
   * Who scrolls.
   *
   * `scroll` — the panel body does, which is what a list or a form wants and
   * what every caller gets unless it says otherwise.
   * `fill` — the child is handed the height and scrolls inside itself, for an
   * editor that has to fill the panel. The child owns it from there: nothing
   * here will scroll, so a child that overflows is simply cut off.
   */
  body?: 'scroll' | 'fill'
  /** Sits beside the close button — a control about the panel, not its contents. */
  headerAction?: React.ReactNode
}) {
  const keyboard = useKeyboardInset()
  const drawer = layout === 'drawer' || layout === 'full'

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="bg-overlay fixed inset-0 z-50 backdrop-blur-sm" />
      <DialogPrimitive.Content
        className={cn(
          'glass-strong fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl',
          /*
           * On a phone all three are the same sheet: it already stands at
           * 96dvh, so there is nothing left for `full` to give. The difference
           * only exists from `sm:` up, which is also the only place a side
           * panel is narrow enough to be worth escaping.
           */
          layout === 'full'
            ? 'bottom-[var(--keyboard-inset)] max-h-[calc(96dvh-var(--keyboard-inset))] sm:inset-4 sm:bottom-4 sm:h-auto sm:max-h-none sm:w-auto sm:max-w-none sm:translate-x-0 sm:translate-y-0 sm:rounded-2xl'
            : drawer
              ? 'bottom-[var(--keyboard-inset)] max-h-[calc(96dvh-var(--keyboard-inset))] sm:inset-y-0 sm:right-0 sm:bottom-0 sm:left-auto sm:h-full sm:max-h-none sm:w-full sm:max-w-xl sm:translate-x-0 sm:translate-y-0 sm:rounded-none sm:rounded-l-2xl lg:max-w-2xl'
              : 'bottom-[var(--keyboard-inset)] max-h-[calc(90dvh-var(--keyboard-inset))] sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[85dvh] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
          className,
        )}
        {...props}
        style={{ '--keyboard-inset': `${keyboard}px`, ...props.style } as React.CSSProperties}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-4 pt-4 pb-3">
          <div>
            <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-text-muted mt-0.5 text-sm">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {headerAction}
            <DialogPrimitive.Close
              className="text-text-subtle hover:bg-surface-2 hover:text-text flex size-8 shrink-0 items-center justify-center rounded-full"
              aria-label="Close"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>
        </div>

        <div
          className={cn(
            'min-h-0 flex-1 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
            body === 'fill'
              ? 'flex flex-col overflow-hidden'
              : 'overflow-y-auto overscroll-contain',
          )}
        >
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
