'use client'

import { LogOut } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PATHS } from '@/lib/paths'
import { leaveRoom } from '@/server/actions/chat'

export function LeaveRoom({ roomId }: { roomId: string }) {
  const t = useTranslations('chat')
  const router = useRouter()

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        if (!window.confirm(t('leaveConfirm'))) return
        const result = await leaveRoom(roomId)
        if (result.ok) router.push(PATHS.chat)
      }}
    >
      <LogOut className="size-4" />
      {t('leave')}
    </Button>
  )
}
