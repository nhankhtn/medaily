import type { Metadata } from 'next'
import Link from 'next/link'
import { BarChart3, ClipboardList, HeartPulse, Target, Users, Wallet } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Logo } from '@/components/brand/logo'
import { LocaleSwitcher } from '@/components/shell/locale-switcher'
import { ThemeToggle } from '@/components/shell/theme-toggle'
import { Button } from '@/components/ui/button'
import { SupportDialog } from '@/features/support/support-dialog'
import { PATHS } from '@/lib/paths'
import { alertsEnabled } from '@/server/services/alerts'
import { getShellTheme } from '@/server/services/settings'

const FEATURES = [
  { key: 'featureDaily', icon: ClipboardList },
  { key: 'featureHabits', icon: Target },
  { key: 'featureMoney', icon: Wallet },
  { key: 'featureHealth', icon: HeartPulse },
  { key: 'featurePeople', icon: Users },
  { key: 'featureInsights', icon: BarChart3 },
] as const

/**
 * The first page a stranger sees, and the only one besides the legal notices
 * that search engines are allowed to index — everything else behind the gate
 * is somebody's private data.
 */
export const metadata: Metadata = {
  robots: { index: true, follow: true },
  alternates: { canonical: PATHS.welcome },
}

export default async function WelcomePage() {
  const [t, theme] = await Promise.all([getTranslations('welcome'), getShellTheme()])
  // Offered only where there is a chat to forward to: a button that swallows
  // what somebody wrote is worse than no button.
  const canWriteIn = alertsEnabled()

  return (
    <div className="login-page relative flex min-h-dvh flex-col overflow-hidden">
      <div aria-hidden className="login-orb login-orb-a" />
      <div aria-hidden className="login-orb login-orb-b" />
      <div aria-hidden className="login-orb login-orb-c" />

      <header className="relative z-10 flex items-center gap-2 px-4 pt-[max(1rem,var(--safe-top))] pr-[max(1rem,var(--safe-right))] pl-[max(1rem,var(--safe-left))] sm:px-8">
        <div className="flex items-center gap-2">
          <Logo size={32} frosted />
          <span className="font-brand text-lg font-semibold tracking-tight">{t('brand')}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle current={theme} />
          <LocaleSwitcher />
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-4 py-10 pr-[max(1rem,var(--safe-right))] pl-[max(1rem,var(--safe-left))] sm:px-8 sm:py-16">
        <h1 className="font-brand text-[1.9rem] leading-[1.15] font-semibold tracking-tight text-balance sm:text-4xl">
          {t('headline')}
        </h1>
        <p className="text-text-muted mt-3 max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
          {t('subtitle')}
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href={PATHS.login}>{t('start')}</Link>
          </Button>
          <p className="text-text-subtle text-xs">{t('freeNote')}</p>
        </div>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
          {FEATURES.map(({ key, icon: Icon }) => (
            <li key={key} className="glass flex items-start gap-3 rounded-[var(--radius)] p-3">
              <Icon className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium">{t(`${key}.title`)}</p>
                <p className="text-text-subtle mt-0.5 text-xs leading-snug">{t(`${key}.body`)}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* The promise a stranger most needs before handing over a journal. */}
        <section className="glass mt-8 rounded-[var(--radius)] p-4">
          <h2 className="text-sm font-semibold">{t('privacyTitle')}</h2>
          <p className="text-text-subtle mt-1 text-xs leading-relaxed">{t('privacyBody')}</p>
        </section>
      </main>

      <footer className="text-text-subtle relative z-10 mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-[max(1.5rem,var(--safe-bottom))] text-xs sm:px-8">
        <Link href={PATHS.legal('privacy')} className="hover:text-text">
          {t('privacyLink')}
        </Link>
        <Link href={PATHS.legal('terms')} className="hover:text-text">
          {t('termsLink')}
        </Link>
        {canWriteIn ? (
          <SupportDialog
            signedIn={false}
            trigger={
              <button type="button" className="hover:text-text">
                {t('contact')}
              </button>
            }
          />
        ) : null}
        <Link href={PATHS.login} className="hover:text-text ml-auto">
          {t('signIn')}
        </Link>
      </footer>
    </div>
  )
}
