import { BarChart3, ClipboardList, Target } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Logo } from '@/components/brand/logo'
import { LocaleSwitcher } from '@/components/shell/locale-switcher'
import { ThemeToggle } from '@/components/shell/theme-toggle'
import { GoogleButton } from '@/features/auth/google-button'
import { LoginForm } from '@/features/auth/login-form'
import { getShellTheme } from '@/server/services/settings'

const PILLARS = [
  { key: 'pillarDaily' as const, icon: ClipboardList },
  { key: 'pillarHabits' as const, icon: Target },
  { key: 'pillarInsights' as const, icon: BarChart3 },
]

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const [t, params, theme] = await Promise.all([
    getTranslations('auth'),
    searchParams,
    getShellTheme(),
  ])

  return (
    <div className="login-page relative flex min-h-dvh flex-col overflow-hidden">
      <div aria-hidden className="login-orb login-orb-a" />
      <div aria-hidden className="login-orb login-orb-b" />
      <div aria-hidden className="login-orb login-orb-c" />

      <header
        className="login-enter relative z-10 flex items-center justify-end gap-2 px-4 pt-[max(1rem,var(--safe-top))] pr-[max(1rem,var(--safe-right))] pl-[max(1rem,var(--safe-left))] sm:px-8"
        style={{ animationDelay: '40ms' }}
      >
        <ThemeToggle current={theme} />
        <LocaleSwitcher />
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-5xl flex-1 content-center items-center gap-6 px-4 py-6 pr-[max(1rem,var(--safe-right))] pb-[max(2rem,var(--safe-bottom))] pl-[max(1rem,var(--safe-left))] sm:px-8 lg:gap-14 lg:py-12 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="login-enter space-y-6 lg:space-y-8" style={{ animationDelay: '80ms' }}>
          <div className="flex items-center justify-center gap-3 lg:justify-start">
            <Logo size={48} className="rounded-[0.9rem] shadow-[var(--shadow-card)]" />
            <p className="font-brand text-2xl font-semibold tracking-tight sm:text-3xl">{t('brand')}</p>
          </div>

          <div className="hidden max-w-md space-y-3 lg:block">
            <h1 className="font-brand text-[1.85rem] leading-[1.15] font-semibold tracking-tight text-balance sm:text-4xl lg:text-[2.6rem]">
              {t('headline')}
            </h1>
            <p className="text-text-muted max-w-sm text-base leading-relaxed text-pretty sm:text-lg">
              {t('subtitle')}
            </p>
          </div>

          <ul className="hidden flex-wrap gap-2 lg:flex">
            {PILLARS.map(({ key, icon: Icon }) => (
              <li
                key={key}
                className="glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-text"
              >
                <Icon className="size-3.5 text-accent" aria-hidden />
                {t(key)}
              </li>
            ))}
          </ul>
        </section>

        <section className="login-enter w-full" style={{ animationDelay: '160ms' }}>
          <div className="glass-strong mx-auto w-full max-w-md rounded-[var(--radius)] lg:mx-0">
            <div className="space-y-6 px-4 pt-6 pb-4 sm:px-6 sm:pt-7 sm:pb-6">
              <div className="space-y-1">
                <h1 className="font-brand text-xl font-semibold tracking-tight lg:hidden">{t('title')}</h1>
                <h2 className="font-brand hidden text-xl font-semibold tracking-tight lg:block">
                  {t('title')}
                </h2>
                <p className="text-text-muted text-sm">{t('titleHint')}</p>
              </div>

              <GoogleButton next={params.next} />
              <LoginForm next={params.next} />
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
