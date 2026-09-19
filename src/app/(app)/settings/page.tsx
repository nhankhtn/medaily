import { Keyboard } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { LocaleSwitcher } from '@/components/shell/locale-switcher'
import { ThemeToggle } from '@/components/shell/theme-toggle'
import { Button } from '@/components/ui/button'
import { CustomMetricsPanel } from '@/features/settings/custom-metrics-panel'
import { DailyFieldsPanel, type MetricUse } from '@/features/settings/daily-fields-panel'
import { ProfileCard } from '@/features/settings/profile-card'
import { DataPanel } from '@/features/settings/data-panel'
import { ReplayOnboardingButton } from '@/features/onboarding/replay-button'
import { SettingsForm } from '@/features/settings/settings-form'
import { ShortcutsDialog } from '@/features/settings/shortcuts-panel'
import { readSession } from '@/lib/auth/current-user'
import { findUserById } from '@/server/repositories/auth'
import { geminiEnabled } from '@/server/services/gemini'
import { findCustomMetrics } from '@/server/repositories/custom-metrics'
import { findGoals } from '@/server/repositories/goals'
import { findHabits } from '@/server/repositories/habits'
import { getSettings } from '@/server/services/settings'

export default async function SettingsPage() {
  const [t, settings, session] = await Promise.all([
    getTranslations('settings'),
    getSettings(),
    readSession(),
  ])
  const user = await findUserById(settings.userId)

  /*
   * What reads each metric, so the panel can warn before a field is switched
   * off rather than leave a habit silently never ticking again.
   */
  const [habits, goals] = await Promise.all([
    findHabits(settings.userId),
    findGoals(settings.userId),
  ])
  const uses: MetricUse = {}
  const note = (key: string | null, kind: 'habits' | 'goals') => {
    if (!key) return
    uses[key] ??= { habits: 0, goals: 0 }
    uses[key][kind] += 1
  }
  for (const habit of habits) note(habit.linkedMetric, 'habits')
  for (const goal of goals) note(goal.metricKey, 'goals')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>

      {user && session ? (
        <ProfileCard user={user} provider={session.provider} subject={session.sub} />
      ) : null}

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
      <DailyFieldsPanel hidden={settings.hiddenDailyFields} uses={uses} />
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
