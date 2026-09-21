import { Keyboard } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { BottomNav } from '@/components/shell/bottom-nav'
import { Header } from '@/components/shell/header'
import { Sidebar } from '@/components/shell/sidebar'
import { CaptureBox } from '@/features/capture/capture-box'
import { PendingSaves } from '@/features/daily/pending-saves'
import { PendingTransactions } from '@/features/finance/pending-transactions'
import { PendingTimerStops } from '@/features/timer/pending-stops'
import { RegisterServiceWorker } from '@/features/daily/register-sw'
import { assistantEnabled } from '@/server/services/assistant'
import { ShortcutProvider } from '@/features/shortcuts/provider'
import { TourGuide } from '@/features/onboarding/tour-guide'
import { ShortcutsDialog } from '@/features/settings/shortcuts-panel'
import { today } from '@/lib/dates'
import { aiServiceConfigured } from '@/server/services/ai-service'
import { cn } from '@/lib/utils'
import { dayContextOf, getShellSettings, getShellTheme } from '@/server/services/settings'

/**
 * The application shell. It lives in a route group so the sign-in page renders
 * on its own, without navigation to a place the visitor cannot reach yet.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [settings, theme, t] = await Promise.all([
    getShellSettings(),
    getShellTheme(),
    getTranslations('settings'),
  ])
  const logicalToday = today(dayContextOf(settings))

  return (
    <ShortcutProvider bindings={settings.shortcuts}>
      <div className="flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header today={logicalToday} theme={theme} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] md:pb-8">
            {children}
          </main>
        </div>
      </div>
      <BottomNav />
      <CaptureBox enabled={aiServiceConfigured()} assistant={assistantEnabled()} />
      <PendingSaves />
      <PendingTransactions />
      <PendingTimerStops />
      <RegisterServiceWorker />
      {/* In the shell, not on a page: the tour walks from page to page. */}
      <Suspense fallback={null}>
        <TourGuide />
      </Suspense>
      {/*
       * Stacked above the capture launcher, which is anchored to the same
       * corner. It sits below the panel's z-index on purpose: once capture is
       * open, the panel owns that corner.
       */}
      <div
        className={cn(
          'fixed right-4 z-30 max-md:hidden md:right-6',
          aiServiceConfigured()
            ? 'bottom-[calc(9.5rem+env(safe-area-inset-bottom,0px))] md:bottom-[5.25rem]'
            : 'bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6',
        )}
      >
        <ShortcutsDialog
          captureEnabled={aiServiceConfigured()}
          global
          trigger={
            <button
              type="button"
              aria-label={t('shortcuts.title')}
              title={t('shortcuts.title')}
              className="glass text-text-muted hover:border-border-strong hover:text-text flex size-10 items-center justify-center rounded-full transition-colors"
            >
              <Keyboard className="size-4.5" />
            </button>
          }
        />
      </div>
    </ShortcutProvider>
  )
}
