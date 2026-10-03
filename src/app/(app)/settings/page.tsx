import { Keyboard, LifeBuoy } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { LocaleSwitcher } from '@/components/shell/locale-switcher'
import { ThemeToggle } from '@/components/shell/theme-toggle'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ProfileCard } from '@/features/settings/profile-card'
import { DataPanel } from '@/features/settings/data-panel'
import { DeleteAccount } from '@/features/settings/delete-account'
import { ActivityDialog } from '@/features/settings/activity-dialog'
import { SupportDialog } from '@/features/support/support-dialog'
import { alertsEnabled } from '@/server/services/alerts'
import { activityLogEnabled, findActivity } from '@/server/services/activity'
import { env } from '@/lib/env'
import { InstallApp } from '@/features/settings/install-app'
import { NotificationsPanel } from '@/features/settings/notifications-panel'
import { ReplayOnboardingButton } from '@/features/onboarding/replay-button'
import { SettingsForm } from '@/features/settings/settings-form'
import { ShortcutsDialog } from '@/features/settings/shortcuts-panel'
import { readSession } from '@/lib/auth/current-user'
import { findUserById } from '@/server/repositories/auth'
import { claimUsername } from '@/server/services/auth'
import { aiServiceConfigured } from '@/server/services/ai-service'
import { getSettings } from '@/server/services/settings'

export default async function SettingsPage() {
  const [t, tSupport, settings, session] = await Promise.all([
    getTranslations('settings'),
    getTranslations('support'),
    getSettings(),
    readSession(),
  ])
  let user = await findUserById(settings.userId)
  // The handle starts as the mailbox name. Filling it here means an account
  // that signed up before usernames existed can be found without signing in again.
  if (user && !user.username && user.email) {
    await claimUsername(user.id, user.email)
    user = await findUserById(settings.userId)
  }
  // Read here rather than inside the dialog so the first page is already in
  // the markup when the button is pressed.
  const trail = activityLogEnabled() ? await findActivity(settings.userId) : null

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>

      {user && session ? (
        <ProfileCard
          user={user}
          provider={session.provider}
          subject={session.sub}
          actions={
            trail ? <ActivityDialog initialPage={trail} days={env.ACTIVITY_LOG_DAYS} /> : null
          }
        />
      ) : null}

      <section className="glass rounded-[var(--radius)] p-4">
        <h2 className="text-sm font-semibold">{t('language')}</h2>
        <p className="text-text-subtle mt-0.5 mb-3 text-xs">{t('languageHelp')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <LocaleSwitcher />
          <ThemeToggle current={settings.theme} />
          <ReplayOnboardingButton />
        </div>
      </section>

      {/* Renders nothing once the app is on the home screen, or where the
          browser has no way to put it there. */}
      <InstallApp />
      {/* After Install, because on an iPhone the answer to "why no
          notifications" is "install it first" — and that card is the answer. */}
      <NotificationsPanel />

      <SettingsForm settings={settings} />
      <section className="glass hidden rounded-[var(--radius)] p-4 sm:block">
        <h2 className="text-sm font-semibold">{t('shortcuts.title')}</h2>
        <p className="text-text-subtle mt-0.5 mb-3 text-xs leading-snug">{t('shortcuts.help')}</p>
        <ShortcutsDialog
          captureEnabled={aiServiceConfigured()}
          trigger={
            <Button variant="outline" size="sm">
              <Keyboard className="size-4" />
              {t('shortcuts.open')}
            </Button>
          }
        />
      </section>
      <DataPanel />
      {alertsEnabled() ? (
        <Card className="space-y-3 p-4">
          <div>
            <h2 className="text-sm font-semibold">{tSupport('title')}</h2>
            <p className="text-text-subtle mt-0.5 text-xs leading-snug">{tSupport('body')}</p>
          </div>
          <SupportDialog
            signedIn={Boolean(session)}
            trigger={
              <Button size="sm" variant="outline">
                <LifeBuoy className="size-4" />
                {tSupport('send')}
              </Button>
            }
          />
        </Card>
      ) : null}
      {session ? <DeleteAccount subject={session.sub} /> : null}
    </div>
  )
}
