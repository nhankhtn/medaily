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
  const [t, format, timer] = await Promise.all([
    getTranslations('common'),
    getFormatter(),
    getRunningTimer(),
  ])

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border-base bg-bg/90 px-4 backdrop-blur">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-medium text-text-muted">
          {format.dateTime(fromISODate(today), {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      </div>

      {timer ? (
        <TimerWidget key={timer.startedAt} timer={timer} topics={[]} projects={[]} compact />
      ) : null}
      <CommandPalette today={today} />
      <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
        <Link href="/daily">
          <ClipboardList className="size-4" />
          {t('today')}
        </Link>
      </Button>
      <LocaleSwitcher />
      <ThemeToggle current={theme} />
      <SignOutButton />
    </header>
  )
}
