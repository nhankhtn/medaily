'use client'

import { ChevronDown, ImagePlus, Images, Loader2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { attachPhoto, removePhoto, requestPhotoUpload } from '@/server/actions/media'
import type { PhotoView } from '@/server/services/media'
import { cn } from '@/lib/utils'

const MAX_BYTES = 15 * 1024 * 1024

export function PersonPhotos({
  personId,
  personName,
  photos,
  enabled,
}: {
  personId: string
  personName: string
  photos: PhotoView[]
  enabled: boolean
}) {
  const t = useTranslations('people')
  const tc = useTranslations('common')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<PhotoView | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  if (!enabled) return null

  const upload = async (files: FileList) => {
    const chosen = [...files].filter((file) => file.type.startsWith('image/'))
    if (chosen.length === 0) return
    if (chosen.some((file) => file.size > MAX_BYTES)) {
      toast.error(t('photoTooLarge'))
      return
    }

    setUploading(true)
    try {
      const ticket = await requestPhotoUpload({ personId })
      if (!ticket.ok) {
        toast.error(tc('error'))
        return
      }

      for (const file of chosen) {
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

        const asset = (await response.json()) as {
          public_id: string
          format?: string
          width?: number
          height?: number
          bytes?: number
        }

        const saved = await attachPhoto({
          personId,
          publicId: asset.public_id,
          format: asset.format ?? null,
          width: asset.width ?? null,
          height: asset.height ?? null,
          bytes: asset.bytes ?? null,
        })
        if (!saved.ok) throw new Error(saved.error)
      }

      toast.success(t('photosAdded', { count: chosen.length }))
      setOpen(true)
      router.refresh()
    } catch (error) {
      console.error('[people] photo upload failed:', error)
      toast.error(tc('error'))
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = (photo: PhotoView) =>
    startTransition(async () => {
      try {
        const result = await removePhoto({ photoId: photo.id })
        if (!result.ok) {
          toast.error(tc('error'))
          return
        }
        setViewing(null)
        toast.success(t('photoRemoved'))
        router.refresh()
      } catch (error) {
        console.error('[people] photo delete failed:', error)
        toast.error(tc('error'))
      }
    })

  return (
    <div className="mt-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="text-text-subtle hover:text-text flex items-center gap-1.5 text-xs"
        >
          <Images className="size-3.5" />
          {photos.length === 0 ? t('noPhotos') : t('photoCount', { count: photos.length })}
          {photos.length > 0 ? (
            <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
          ) : null}
        </button>

        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <ImagePlus className="size-3" />
          )}
        </Button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files) void upload(event.target.files)
          }}
        />
      </div>

      {open && photos.length > 0 ? (
        <ul className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {photos.map((photo) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setViewing(photo)}
                className="border-border-base hover:border-accent block aspect-square w-full overflow-hidden rounded-[var(--radius)] border"
              >
                <img
                  src={photo.thumbUrl}
                  alt={photo.caption ?? t('photoOf', { name: personName })}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog open={viewing !== null} onOpenChange={(next) => !next && setViewing(null)}>
        {viewing ? (
          <DialogContent
            title={viewing.caption ?? t('photoOf', { name: personName })}
            className="sm:max-w-3xl"
          >
            <div className="space-y-3">
              <img
                src={viewing.fullUrl}
                alt={viewing.caption ?? t('photoOf', { name: personName })}
                className="max-h-[70dvh] w-full rounded-[var(--radius)] object-contain"
              />
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => remove(viewing)}
                  className="text-bad"
                >
                  <Trash2 className="size-4" />
                  {tc('delete')}
                </Button>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  )
}
