'use client'

import { RotateCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { isStandalone } from '@/lib/pwa'
import { cn } from '@/lib/utils'

/**
 * Standalone PWAs have no browser refresh control. Show one only when the
 * page was opened from the home-screen icon.
 */
export function StandaloneReload() {
  const t = useTranslations('common')
  // False on the server and in the first client render, so hydration matches;
  // the real answer a moment later. How the page was opened never changes
  // while it is open, so there is nothing to subscribe to.
  const standalone = useSyncExternalStore(neverChanges, isStandalone, () => false)
  const [reloading, setReloading] = useState(false)

  /*
   * A page handed back from the back-forward cache is the one that was
   * reloading when it was put away, spinner and all. It is not reloading now.
   */
  useEffect(() => {
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) setReloading(false)
    }
    window.addEventListener('pageshow', restored)
    return () => window.removeEventListener('pageshow', restored)
  }, [])

  if (!standalone) return null

  return (
    <Button
      type="button"
      variant="ghost"
      size="iconSm"
      aria-label={t('reload')}
      aria-busy={reloading}
      disabled={reloading}
      onClick={() => {
        /*
         * The old page stays on screen until the new one has arrived, and on
         * a slow connection that is long enough to tap again wondering
         * whether the first one took. Spinning says it did.
         */
        setReloading(true)
        window.location.reload()
      }}
    >
      <RotateCw className={cn('size-4', reloading && 'animate-spin')} />
    </Button>
  )
}

const neverChanges = () => () => {}
