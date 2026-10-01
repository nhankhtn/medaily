'use client'

import { Camera, Loader2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { attachRoomAvatar, removeRoomAvatar, requestRoomAvatarUpload } from '@/server/actions/chat'

const MAX_BYTES = 5 * 1024 * 1024

/**
 * The picture a group wears.
 *
 * The same shape as the profile avatar in Settings, and for the same reason:
 * the file goes straight to Cloudinary from the browser and the app is told
 * only where it landed, so a picture never passes through the server at all.
 *
 * Replacing one deletes the one before it. A room has a single picture, so
 * the old asset is reachable from nothing the moment the new one is attached,
 * and leaving it there would be paying to store something unreachable.
 */
export function RoomAvatarPicker({
  roomId,
  title,
  avatarUrl,
}: {
  roomId: string
  title: string
  avatarUrl: string | null
}) {
  const t = useTranslations('chat')
  const tc = useTranslations('common')
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const busy = uploading || pending

  const upload = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error(t('photoInvalid'))
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error(t('photoTooLarge'))
      return
    }

    setUploading(true)
    try {
      const ticket = await requestRoomAvatarUpload(roomId)
      if (!ticket.ok) {
        toast.error(ticket.error === 'disabled' ? t('photoDisabled') : tc('error'))
        return
      }

      const form = new FormData()
      form.append('file', file)
      form.append('api_key', ticket.ticket.apiKey)
      form.append('timestamp', String(ticket.ticket.timestamp))
      form.append('folder', ticket.ticket.folder)
      form.append('signature', ticket.ticket.signature)

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${ticket.ticket.cloudName}/image/upload`,
        { method: 'POST', body: form },
      )
      if (!response.ok) throw new Error(`upload failed: ${response.status}`)

      const asset = (await response.json()) as { public_id: string }
      const saved = await attachRoomAvatar({ roomId, publicId: asset.public_id })
      if (!saved.ok) throw new Error('the server refused the picture')

      toast.success(t('photoUpdated'))
      router.refresh()
    } catch (error) {
      console.error('[chat] room picture upload failed:', error)
      toast.error(tc('error'))
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const clear = () =>
    startTransition(async () => {
      const result = await removeRoomAvatar(roomId)
      if (!result.ok) {
        toast.error(tc('error'))
        return
      }
      toast.success(t('photoRemoved'))
      router.refresh()
    })

  const initial = [...title.trim()][0]?.toUpperCase() ?? '?'

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => !busy && inputRef.current?.click()}
        disabled={busy}
        aria-label={t('changePhoto')}
        className={cn(
          'group border-border-base relative size-24 overflow-hidden rounded-full border',
          'focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2',
          busy && 'opacity-70',
        )}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          <span
            aria-hidden
            className="bg-accent text-accent-text flex size-full items-center justify-center text-3xl font-semibold"
          >
            {initial}
          </span>
        )}
        {/*
         * Held open while the upload runs. Hover is what reveals this the
         * rest of the time, and a phone has no hover — so the one moment
         * the spinner exists for was the one moment it could not be seen.
         */}
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity',
            busy
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
          )}
        >
          {busy ? (
            <Loader2 className="size-6 animate-spin text-white" />
          ) : (
            <Camera className="size-6 text-white" />
          )}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void upload(event.target.files?.[0])}
      />

      {busy ? (
        <p className="text-text-subtle text-xs">{uploading ? t('photoUploading') : tc('saving')}</p>
      ) : avatarUrl ? (
        <button
          type="button"
          onClick={clear}
          disabled={busy}
          className="text-text-subtle hover:text-bad inline-flex items-center gap-1 text-xs disabled:opacity-50"
        >
          <Trash2 className="size-3" />
          {t('removePhoto')}
        </button>
      ) : null}
    </div>
  )
}
