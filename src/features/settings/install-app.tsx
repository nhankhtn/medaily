'use client'

import { Download, Share, SquarePlus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'

/**
 * Chrome's install event. Not in lib.dom, because it is not a standard — it
 * is the whole reason this works on Android and cannot on iOS.
 */
type InstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Mode =
  /** Already on the home screen, or the browser will never offer it. */
  | 'hidden'
  /** Chromium handed us its prompt: a button can actually install. */
  | 'prompt'
  /** iOS, where nothing can. All we can do is say where the control is. */
  | 'guide'

function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // Safari's own flag, which predates the standard media query and is still
  // the only one it sets.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

/**
 * iPhone and iPad. iPadOS reports itself as a Mac, so the touch count is what
 * separates a tablet from a desktop — ugly, and the only thing available:
 * Safari exposes no capability to ask about instead.
 */
function isIosSafari(): boolean {
  const ua = window.navigator.userAgent
  const iPhone = /iphone|ipod/i.test(ua)
  const iPad = /ipad/i.test(ua) || (/macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1)
  if (!iPhone && !iPad) return false
  // Every browser on iOS is Safari underneath, but Chrome and Firefox there
  // have no Add to Home Screen at all, so the instructions would be wrong.
  return !/crios|fxios|edgios/i.test(ua)
}

/**
 * Installing the app to the home screen.
 *
 * Android gets a real button: Chromium fires `beforeinstallprompt`, and
 * holding on to it lets our own control raise the native install dialog.
 *
 * iOS gets instructions and nothing more. Safari has never exposed a way to
 * trigger Add to Home Screen, so a button claiming to do it would be a lie —
 * what it can do is show where the control is, since Share → Add to Home
 * Screen is not something anyone finds by looking.
 *
 * Worth more than tidiness on iOS: an installed web app is outside the rule
 * that clears storage for a site untouched for a week, which is what keeps a
 * day or a transaction queued offline from being swept away.
 */
export function InstallApp() {
  const t = useTranslations('settings.install')
  const [mode, setMode] = useState<Mode>('hidden')
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)

  useEffect(() => {
    if (isStandalone()) return

    const onPrompt = (event: Event) => {
      // Chromium shows its own banner unless this is taken over.
      event.preventDefault()
      setPrompt(event as InstallPrompt)
      setMode('prompt')
    }

    // It has usually fired before this mounts, so the listener alone is not
    // enough — iOS is decided here and now, and Chromium upgrades us later.
    // Which browser this is cannot be known while rendering on the server, so
    // the first honest moment to decide is after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only capability check
    if (isIosSafari()) setMode('guide')

    window.addEventListener('beforeinstallprompt', onPrompt)
    // Fires when the install completes, whichever way it was started.
    const onInstalled = () => setMode('hidden')
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
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
            // One prompt per event; Chromium fires a fresh one if the person
            // dismisses it and becomes eligible again.
            void prompt.userChoice.finally(() => {
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
          </DialogContent>
        </Dialog>
      )}
    </section>
  )
}
