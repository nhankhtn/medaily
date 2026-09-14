import { Keyboard } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { LocaleSwitcher } from '@/components/shell/locale-switcher'
import { ThemeToggle } from '@/components/shell/theme-toggle'
import { Button } from '@/components/ui/button'
import { CustomMetricsPanel } from '@/features/settings/custom-metrics-panel'
import { DataPanel } from '@/features/settings/data-panel'
import { ReplayOnboardingButton } from '@/features/onboarding/replay-button'
import { SettingsForm } from '@/features/settings/settings-form'
import { ShortcutsDialog } from '@/features/settings/shortcuts-panel'
import { geminiEnabled } from '@/server/services/gemini'
import { findCustomMetrics } from '@/server/repositories/custom-metrics'
import { getSettings } from '@/server/services/settings'

export default async function SettingsPage() {
  const [t, settings] = await Promise.all([getTranslations('settings'), getSettings()])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>

      <section className="border-border-base bg-surface rounded-[var(--radius)] border p-4">
        <h2 className="text-sm font-semibold">{t('language')}</h2>
        <p className="text-text-subtle mt-0.5 mb-3 text-xs">{t('languageHelp')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <LocaleSwitcher />
          <ThemeToggle current={settings.theme} />
          <ReplayOnboardingButton />
        </div>
      </section>

      <SettingsForm settings={settings} />
      <CustomMetricsPanel metrics={await findCustomMetrics(settings.userId)} />
      <section className="border-border-base bg-surface rounded-[var(--radius)] border p-4">
        <h2 className="text-sm font-semibold">{t('shortcuts.title')}</h2>
        <p className="text-text-subtle mt-0.5 mb-3 text-xs leading-snug">{t('shortcuts.help')}</p>
        <ShortcutsDialog
          captureEnabled={geminiEnabled()}
          trigger={
            <Button variant="outline" size="sm">
              <Keyboard className="size-4" />
              {t('shortcuts.open')}
            </Button>
          }
        />
      </section>
      <DataPanel />
    </div>
  )
}
