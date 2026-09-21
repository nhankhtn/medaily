'use client'

import { Download, Share } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { IosInstallSteps } from '@/features/settings/install-app'
import {
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  hasSeenInstallOffer,
  markInstallOfferSeen,
  resolveInstallMode,
  subscribeInstallPrompt,
  TOUR_FINISHED_EVENT,
  type InstallMode,
  type InstallPrompt,
} from '@/features/settings/install-capability'

/**
 * After the welcome tour ends, ask once whether to pin the app to the home
 * screen — the moment someone has just learned what the app is for, and the
 * best chance they still have the install prompt Chromium deferred.
 */
export function InstallAfterTour() {
  const t = useTranslations('onboarding.installOffer')
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<InstallMode>('hidden')
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)

  useEffect(() => {
    const sync = () => setPrompt(getDeferredInstallPrompt())
    sync()
    return subscribeInstallPrompt(sync)
  }, [])

  useEffect(() => {
    const onTourFinished = () => {
      if (hasSeenInstallOffer()) return
      const next = resolveInstallMode(getDeferredInstallPrompt() !== null)
      if (next === 'hidden') {
        // Desktop Chromium without eligibility: nothing useful to show.
        markInstallOfferSeen()
        return
      }
      setPrompt(getDeferredInstallPrompt())
      setMode(next)
      setOpen(true)
    }

    window.addEventListener(TOUR_FINISHED_EVENT, onTourFinished)
    return () => window.removeEventListener(TOUR_FINISHED_EVENT, onTourFinished)
  }, [])

  const close = () => {
    markInstallOfferSeen()
    setOpen(false)
  }

  const install = () => {
    if (!prompt) return
    void prompt.prompt()
    void prompt.userChoice.finally(() => {
      clearDeferredInstallPrompt()
      setPrompt(null)
      close()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
        else setOpen(true)
      }}
    >
      <DialogContent title={t('title')} description={t('body')}>
        <div className="space-y-4">
          {mode === 'guide' ? <IosInstallSteps /> : null}

          <div className="flex flex-wrap gap-2">
            {mode === 'prompt' ? (
              <Button onClick={install}>
                <Download className="size-4" />
                {t('add')}
              </Button>
            ) : null}
            {mode === 'guide' ? (
              <Button onClick={close}>
                <Share className="size-4" />
                {t('gotIt')}
              </Button>
            ) : null}
            <Button variant="ghost" onClick={close}>
              {t('later')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
