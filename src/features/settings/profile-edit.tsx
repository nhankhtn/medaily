'use client'

import { Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { saveProfile } from '@/server/actions/settings'

/** Name and username, opened from the button beside the avatar. */
export function ProfileEdit({
  displayName,
  username,
}: {
  displayName: string
  username: string | null
}) {
  const t = useTranslations('settings.profile')
  const tc = useTranslations('common')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(displayName)
  const [handle, setHandle] = useState(username ?? '')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const result = await saveProfile({ displayName: name, username: handle })
    setBusy(false)
    if (result.ok) {
      setHandle(result.username)
      setOpen(false)
      toast.success(t('profileSaved'))
      router.refresh()
      return
    }
    toast.error(
      t(result.error === 'taken' ? 'handleTaken' : result.error === 'invalid_name' ? 'nameInvalid' : 'handleInvalid'),
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setName(displayName)
          setHandle(username ?? '')
        }
        setOpen(next)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('editProfile')} className="shrink-0">
          <Pencil className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent title={t('editProfile')}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{t('name')}</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{t('handle')}</span>
            <Input
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              autoComplete="username"
              maxLength={20}
              spellCheck={false}
              required
            />
            <span className="text-text-subtle block text-xs">{t('handleHelp')}</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {tc('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
