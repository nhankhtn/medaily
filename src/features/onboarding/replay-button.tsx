'use client'

import { RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { restartOnboarding } from '@/server/actions/onboarding'

export function ReplayOnboardingButton() {
  const t = useTranslations('onboarding')
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await restartOnboarding()
          toast.success(t('replayDone'))
        })
      }
    >
      <RotateCcw className="size-3.5" />
      {t('replay')}
    </Button>
  )
}
