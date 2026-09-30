'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PATHS } from '@/lib/paths'
import { createRoom } from '@/server/actions/chat'

export function NewRoom() {
  const t = useTranslations('chat')
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={async (event) => {
        event.preventDefault()
        if (title.trim() === '' || busy) return
        setBusy(true)
        const result = await createRoom({ title: title.trim() })
        setBusy(false)
        if (result.ok) {
          setTitle('')
          router.push(PATHS.chatRoom(result.roomId))
        }
      }}
    >
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={t('roomName')}
        aria-label={t('roomName')}
        maxLength={120}
      />
      <Button type="submit" disabled={busy || title.trim() === ''}>
        <Plus className="size-4" />
        {t('create')}
      </Button>
    </form>
  )
}
