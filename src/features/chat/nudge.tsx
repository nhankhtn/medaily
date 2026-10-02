'use client'

import { Hand } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { nudgeRoom } from '@/server/actions/chat'

/** Long enough to read as an answer, short enough not to be a state. */
const WAVE_MS = 700

/**
 * Asking for somebody's attention with no words in it.
 *
 * Beside the room's own menu rather than in it: a thing people do on impulse
 * does not survive being two taps deep. The hand waves on the way out, which
 * is the only acknowledgement there is — nothing is written to the room, so
 * without it there would be no way to tell it had happened at all.
 */
export function Nudge({ roomId }: { roomId: string }) {
  const t = useTranslations('chat')
  const [waving, setWaving] = useState(false)

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t('nudge')}
      title={t('nudge')}
      disabled={waving}
      onClick={() => {
        setWaving(true)
        setTimeout(() => setWaving(false), WAVE_MS)
        navigator.vibrate?.(12)
        void nudgeRoom(roomId).then((result) => {
          if (result.ok) return toast.success(t('nudged'))
          // Being told to wait is the only outcome worth a sentence: the
          // others are "the room is gone", which the page already says.
          if (result.error === 'rate_limited') toast(t('nudgeTooSoon'))
        })
      }}
    >
      <Hand className={waving ? 'chat-wave size-5' : 'size-5'} />
    </Button>
  )
}
