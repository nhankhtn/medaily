import { Suspense } from 'react'
import { getFormatter, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { CommandPalette } from './command-palette'
import { LocaleSwitcher } from './locale-switcher'
import { SignOutButton } from './sign-out-button'
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
     * Glass must live on this sticky root (not an absolute child). Safari 26
     * samples background-color + backdrop-filter on edge sticky/fixed nodes to
     * tint the notch / Dynamic Island ears; absolute children are ignored and
     * the ears fall back to flat --bg.
     */
    <header className="glass-strong sticky top-0 z-30 border-x-0 border-t-0 pt-[env(safe-area-inset-top,0px)]">
      <div className="flex h-14 items-center gap-3 pr-[max(1rem,env(safe-area-inset-right,0px))] pl-[max(1rem,env(safe-area-inset-left,0px))]">
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
      </div>
    </header>
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
