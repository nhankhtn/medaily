import { getTranslations } from 'next-intl/server'
import { LocaleSwitcher } from '@/components/shell/locale-switcher'
import { ThemeToggle } from '@/components/shell/theme-toggle'
import { DataPanel } from '@/features/settings/data-panel'
import { ReplayOnboardingButton } from '@/features/onboarding/replay-button'
import { SettingsForm } from '@/features/settings/settings-form'
import { getSettings } from '@/server/services/settings'

export default async function SettingsPage() {
  const [t, settings] = await Promise.all([getTranslations('settings'), getSettings()])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>

      <section className="rounded-[var(--radius)] border border-border-base bg-surface p-4">
        <h2 className="text-sm font-semibold">{t('language')}</h2>
        <p className="mt-0.5 mb-3 text-xs text-text-subtle">{t('languageHelp')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <LocaleSwitcher />
          <ThemeToggle current={settings.theme} />
          <ReplayOnboardingButton />
        </div>
      </section>

      <SettingsForm settings={settings} />
      <DataPanel />
    </div>
  )
}
