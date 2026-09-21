'use client'

import { Download, Share, SquarePlus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import {
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  resolveInstallMode,
  subscribeInstallPrompt,
  type InstallMode,
} from './install-capability'

/**
 * Installing the app to the home screen — the Settings card.
 *
 * Android gets a real button from the deferred Chromium prompt. iOS gets
 * instructions only: Safari never exposes a way to trigger Add to Home Screen.
 *
 * Worth more than tidiness on iOS: an installed web app is outside the rule
 * that clears storage for a site untouched for a week, which is what keeps
 * offline queues from being swept away.
 */
export function InstallApp() {
  const t = useTranslations('settings.install')
  const [mode, setMode] = useState<InstallMode>('hidden')
  const [prompt, setPrompt] = useState(getDeferredInstallPrompt)

  useEffect(() => {
    const sync = () => {
      const next = getDeferredInstallPrompt()
      setPrompt(next)
      setMode(resolveInstallMode(next !== null))
    }
    sync()
    return subscribeInstallPrompt(sync)
  }, [])

  if (mode === 'hidden') return null

  return (
    <section className="glass rounded-[var(--radius)] p-4">
      <h2 className="text-sm font-semibold">{t('title')}</h2>
      <p className="text-text-subtle mt-0.5 mb-3 text-xs leading-snug">{t('help')}</p>

      {mode === 'prompt' ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (!prompt) return
            void prompt.prompt()
            void prompt.userChoice.finally(() => {
              clearDeferredInstallPrompt()
              setPrompt(null)
              setMode('hidden')
            })
          }}
        >
          <Download className="size-4" />
          {t('action')}
        </Button>
      ) : (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Share className="size-4" />
              {t('action')}
            </Button>
          </DialogTrigger>
          <DialogContent title={t('title')} description={t('iosIntro')}>
            <IosInstallSteps />
          </DialogContent>
        </Dialog>
      )}
    </section>
  )
}

export function IosInstallSteps() {
  const t = useTranslations('settings.install')
  return (
    <ol className="text-text-muted space-y-3 text-sm">
      <li className="flex items-center gap-2.5">
        <Share className="text-text size-5 shrink-0" />
        <span>{t('iosStepShare')}</span>
      </li>
      <li className="flex items-center gap-2.5">
        <SquarePlus className="text-text size-5 shrink-0" />
        <span>{t('iosStepAdd')}</span>
      </li>
    </ol>
  )
}
