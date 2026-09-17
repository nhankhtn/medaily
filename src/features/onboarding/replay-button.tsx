'use client'

import { RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { TOUR_STEPS, tourHref } from '@/lib/onboarding/tour'
import { restartOnboarding } from '@/server/actions/onboarding'

/**
 * Starts the tour there and then rather than arming it for the next visit to
 * the dashboard: someone who just asked to see it again is asking now.
 */
export function ReplayOnboardingButton() {
  const t = useTranslations('onboarding')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await restartOnboarding()
          const first = TOUR_STEPS[0]
          if (first) router.push(tourHref(first))
        })
      }
    >
      <RotateCcw className="size-3.5" />
      {t('replay')}
    </Button>
  )
}
