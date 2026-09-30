'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PATHS } from '@/lib/paths'
import { acceptInvite } from '@/server/actions/chat'

export function JoinRoom({ code }: { code: string }) {
  const t = useTranslations('chat')
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)

  if (refused) return <p className="text-text-muted text-sm">{refused}</p>

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="lg"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          const result = await acceptInvite(code)
          setBusy(false)
          if (result.ok) {
            router.push(PATHS.chatRoom(result.roomId))
            return
          }
          // Expired, revoked, spent and never-existed all say the same thing,
          // so somebody trying codes learns nothing from the difference.
          setRefused(t(result.error === 'rate_limited' ? 'tooFast' : 'joinGone'))
        }}
      >
        {t('joinAccept')}
      </Button>
      <Button variant="ghost" size="lg" onClick={() => router.push(PATHS.home)}>
        {t('joinDecline')}
      </Button>
    </div>
  )
}
