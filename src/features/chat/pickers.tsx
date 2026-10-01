'use client'

import { Smile, Sticker } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { STICKERS, type StickerId } from '@/lib/chat/stickers'
import { cn } from '@/lib/utils'
import { StickerArt } from './sticker-art'

/**
 * A short row of emoji, not a full picker.
 *
 * Every phone and most desktops already have one, and shipping a searchable
 * catalogue would be a megabyte of data to do worse than the keyboard beside
 * it. This is the handful people reach for without thinking.
 */
const QUICK = ['😀', '😂', '🥰', '😭', '😡', '👍', '🙏', '🎉', '🔥', '❤️', '😴', '🤔']

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const t = useTranslations('chat')
  const [open, setOpen] = useState(false)

  return (
    <Tray open={open} onOpenChange={setOpen} label={t('emoji')} icon={<Smile className="size-5" />}>
      <div className="grid grid-cols-6 gap-1">
        {QUICK.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={emoji}
            onClick={() => {
              onPick(emoji)
              setOpen(false)
            }}
            className="hover:bg-surface-2 flex size-10 items-center justify-center rounded-[var(--radius)] text-xl"
          >
            {emoji}
          </button>
        ))}
      </div>
    </Tray>
  )
}

export function StickerPicker({ onPick }: { onPick: (id: StickerId) => void }) {
  const t = useTranslations('chat')
  const [open, setOpen] = useState(false)

  return (
    <Tray
      open={open}
      onOpenChange={setOpen}
      label={t('sticker')}
      icon={<Sticker className="size-5" />}
    >
      <div className="grid grid-cols-4 gap-1">
        {STICKERS.map((id) => (
          <button
            key={id}
            type="button"
            aria-label={id}
            onClick={() => {
              onPick(id)
              setOpen(false)
            }}
            className="hover:bg-surface-2 flex items-center justify-center rounded-[var(--radius)] p-1.5"
          >
            <StickerArt id={id} size={48} />
          </button>
        ))}
      </div>
    </Tray>
  )
}

/**
 * The panel both pickers hang in.
 *
 * Absolutely positioned above the composer rather than in a dialog: a dialog
 * takes focus away from the box you are typing in, and on a phone it covers
 * the conversation you are picking a reply to.
 */
export function Tray({
  open,
  onOpenChange,
  label,
  icon,
  size = 'icon',
  align = 'left',
  triggerClassName,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  label: string
  icon: React.ReactNode
  size?: 'icon' | 'iconSm'
  /** Which edge the panel hangs from, for a trigger near the right margin. */
  align?: 'left' | 'right'
  triggerClassName?: string
  children: React.ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)

  /**
   * Closes on a tap anywhere else.
   *
   * A full-screen backdrop would be fewer lines and it is what I reached for
   * first, but it sits over the panel it is meant to dismiss — the tray lives
   * inside the composer, and the stacking there is not ours to reason about.
   * Listening on the document has no such argument with the layout.
   */
  useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) onOpenChange(false)
    }
    // Escape as well as a tap: a panel that can only be dismissed by aiming at
    // the rest of the page is one a keyboard cannot put away.
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }

    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [open, onOpenChange])

  return (
    <div ref={box} className="relative">
      <Button
        type="button"
        variant="ghost"
        size={size}
        aria-label={label}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={triggerClassName}
      >
        {icon}
      </Button>

      {open ? (
        <div
          className={cn(
            // `w-max` is load-bearing: an absolutely positioned panel has no
            // width of its own, so the grid inside it was given about five
            // pixels a column while each cell kept its forty — every emoji
            // sat on top of its neighbour and the last one in a row took
            // every tap meant for the others.
            'glass border-border-base absolute bottom-full z-20 mb-2 w-max rounded-[var(--radius)] border p-2 shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}
