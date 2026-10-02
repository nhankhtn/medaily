'use client'

import { Lock, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { PATHS } from '@/lib/paths'
import { createRoom } from '@/server/actions/chat'

/**
 * A button that asks, rather than a field that waits.
 *
 * The name box used to sit open above the room list, which put a form on
 * screen for a thing done once in a while and made the list start lower for
 * everybody who was only coming to read. The trigger keeps its place; the
 * question moves into the dialog, where `autoFocus` can put the cursor in it
 * because opening the dialog is what asked for it.
 */
export function NewRoom({ encryptionAvailable }: { encryptionAvailable: boolean }) {
  const t = useTranslations('chat')
  const tc = useTranslations('common')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [encrypted, setEncrypted] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // Cleared on the way out, so reopening is a fresh question rather
        // than whatever was abandoned last time.
        if (!next) {
          setTitle('')
          setEncrypted(false)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          {t('newRoom')}
        </Button>
      </DialogTrigger>

      <DialogContent title={t('newRoom')}>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault()
            if (title.trim() === '' || busy) return
            setBusy(true)
            const result = await createRoom({ title: title.trim(), encrypted })
            setBusy(false)
            if (result.ok) {
              setOpen(false)
              setTitle('')
              setEncrypted(false)
              router.push(PATHS.chatRoom(result.roomId))
            } else {
              toast.error(
                result.error === 'encryption_unavailable'
                  ? t('encryptRoomUnavailable')
                  : tc('error'),
              )
            }
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{t('roomName')}</span>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              autoFocus
              required
            />
          </label>

          {/* Asked once, here: the room keeps the answer for good. */}
          <label className="glass flex items-start gap-2.5 rounded-[var(--radius)] p-3">
            <input
              type="checkbox"
              checked={encrypted}
              disabled={!encryptionAvailable}
              onChange={(event) => setEncrypted(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
            />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <Lock className="text-accent size-3.5" />
                {t('encryptRoom')}
              </span>
              <span className="text-text-subtle mt-0.5 block text-xs">
                {encryptionAvailable ? t('encryptRoomHelp') : t('encryptRoomUnavailable')}
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={busy || title.trim() === ''}>
              {t('create')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
