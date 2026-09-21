'use client'

import { Camera, Loader2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { attachAvatar, removeAvatar, requestAvatarUpload } from '@/server/actions/media'
import { cn } from '@/lib/utils'

const MAX_BYTES = 5 * 1024 * 1024

/**
 * Tap the circle to replace the photo. Uploads go straight to Cloudinary; the
 * app only stores the delivery URL on `users.image_url`.
 */
export function ProfileAvatar({
  imageUrl,
  displayName,
  enabled,
  canRemove,
}: {
  imageUrl: string | null
  displayName: string
  enabled: boolean
  /** Only an uploaded Cloudinary avatar is safe to clear — Google would come back. */
  canRemove: boolean
}) {
  const t = useTranslations('settings.profile')
  const tc = useTranslations('common')
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const busy = uploading || pending

  const pick = () => {
    if (!enabled || busy) {
      if (!enabled) toast.error(t('uploadDisabled'))
      return
    }
    inputRef.current?.click()
  }

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
      const ticket = await requestAvatarUpload()
      if (!ticket.ok) {
        toast.error(ticket.error === 'disabled' ? t('uploadDisabled') : tc('error'))
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
      const saved = await attachAvatar({ publicId: asset.public_id })
      if (!saved.ok) throw new Error(saved.error)

      toast.success(t('photoUpdated'))
      router.refresh()
    } catch (error) {
      console.error('[avatar] upload failed:', error)
      toast.error(tc('error'))
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const clear = () =>
    startTransition(async () => {
      const result = await removeAvatar()
      if (!result.ok) {
        toast.error(tc('error'))
        return
      }
      toast.success(t('photoRemoved'))
      router.refresh()
    })

  const initial = [...displayName.trim()][0]?.toUpperCase() ?? '?'

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={pick}
        disabled={busy}
        aria-label={t('changePhoto')}
        className={cn(
          'group relative size-14 overflow-hidden rounded-full border border-border-base',
          'focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2',
          busy && 'opacity-70',
        )}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" width={56} height={56} className="size-full object-cover" />
        ) : (
          <span
            aria-hidden
            className="bg-accent text-accent-text flex size-full items-center justify-center text-xl font-semibold"
          >
            {initial}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {busy ? (
            <Loader2 className="size-5 animate-spin text-white" />
          ) : (
            <Camera className="size-5 text-white" />
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

      {canRemove && imageUrl ? (
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
