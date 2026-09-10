import { Suspense } from 'react'
import { getFormatter, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { CommandPalette } from './command-palette'
import { LocaleSwitcher } from './locale-switcher'
import { SignOutButton } from './sign-out-button'
import { ThemeToggle } from './theme-toggle'
import { fromISODate, type ISODate } from '@/lib/dates'
import { Button } from '@/components/ui/button'
import { TimerWidget } from '@/features/learning/timer-widget'
import { getRunningTimer } from '@/server/services/learning'

export async function Header({
  today,
  theme,
}: {
  today: ISODate
  theme: 'light' | 'dark' | 'system'
}) {
  const [t, format] = await Promise.all([getTranslations('common'), getFormatter()])

  return (
    <header className="border-border-base bg-bg/90 sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="text-text-muted truncate text-sm font-medium">
          {format.dateTime(fromISODate(today), {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      </div>

      {/* Streamed separately: a badge that is usually absent must not hold up
          the whole shell for a database round trip. */}
      <Suspense fallback={null}>
        <HeaderTimer />
      </Suspense>
      <CommandPalette today={today} />
      <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
        <Link href="/daily">
          <ClipboardList className="size-4" />
          {t('today')}
        </Link>
      </Button>
      <LocaleSwitcher />
      <ThemeToggle current={theme} className="hidden sm:flex" />
      <SignOutButton />
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
  if (!timer) return null

  return <TimerWidget key={timer.startedAt} timer={timer} topics={[]} projects={[]} compact />
}
