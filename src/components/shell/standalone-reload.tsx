'use client'

import { RotateCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { isStandalone } from '@/lib/pwa'

/**
 * Standalone PWAs have no browser refresh control. Show one only when the
 * page was opened from the home-screen icon.
 */
export function StandaloneReload() {
  const t = useTranslations('common')
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    setStandalone(isStandalone())
  }, [])

  if (!standalone) return null

  return (
    <Button
      type="button"
      variant="ghost"
      size="iconSm"
      aria-label={t('reload')}
      onClick={() => window.location.reload()}
    >
      <RotateCw className="size-4" />
    </Button>
  )
}
