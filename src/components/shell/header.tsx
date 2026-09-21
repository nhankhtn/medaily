import { Suspense } from 'react'
import { getFormatter, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { CommandPalette } from './command-palette'
import { LocaleSwitcher } from './locale-switcher'
import { SignOutButton } from './sign-out-button'
import { StandaloneReload } from './standalone-reload'
import { ThemeToggle } from './theme-toggle'
import { fromISODate, type ISODate } from '@/lib/dates'
import { PATHS } from '@/lib/paths'
import { buttonVariants } from '@/components/ui/button-variants'
import { TimerBadge } from '@/features/timer/timer-badge'
import { getRunningTimer } from '@/server/services/timer'
import type { ThemePreference } from '@/lib/themes'
import { cn } from '@/lib/utils'

export async function Header({ today, theme }: { today: ISODate; theme: ThemePreference }) {
  const [t, format] = await Promise.all([getTranslations('common'), getFormatter()])

  return (
    /*
     * Floating chip — same inset / radius language as the sidebar and mobile
     * dock. Outer sticky stays transparent; padding clears the notch while the
     * chip itself carries glass-chip.
     */
    <div
      className={cn(
        'sticky top-0 z-30 px-3',
        'pt-[max(0.75rem,env(safe-area-inset-top,0px))]',
      )}
    >
      <header className="glass-chip flex h-14 items-center gap-3 rounded-[1.75rem] px-3 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-text-muted truncate text-sm font-medium">
            {format.dateTime(fromISODate(today), 'weekdayDayMonthYear')}
          </span>
        </div>

        {/* Streamed separately: a badge that is usually absent must not hold up
            the whole shell for a database round trip. */}
        <Suspense fallback={null}>
          <HeaderTimer />
        </Suspense>
        <StandaloneReload />
        <CommandPalette today={today} />
        <Link
          href={PATHS.daily}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'hidden sm:inline-flex')}
        >
          <ClipboardList className="size-4" />
          {t('today')}
        </Link>
        {/* Language, theme and sign-out live in the More sheet on a phone —
            the header has room for the date, the run and search, and no more. */}
        <LocaleSwitcher className="hidden sm:flex" />
        <ThemeToggle current={theme} className="hidden sm:flex" />
        <span className="hidden sm:block">
          <SignOutButton />
        </span>
      </header>
    </div>
  )
}

async function HeaderTimer() {
  /*
   * `Suspense` above catches pending, not throwing. This query lives in the
   * layout, so an unreachable database here would take the whole shell down
   * before any page-level boundary could help. A missing badge is the right
   * degraded state for it.
   */
  const timer = await getRunningTimer().catch((error: unknown) => {
    console.error('[shell] running timer unavailable:', error)
    return null
  })
  return <TimerBadge key={timer?.startedAt ?? 'idle'} timer={timer} />
}
