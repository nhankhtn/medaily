'use client'

import { Heart, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { cn } from '@/lib/utils'
import {
  DARK_THEME_IDS,
  THEME_PREFERENCES,
  type ThemePreference,
} from '@/lib/themes'
import { setTheme } from '@/server/actions/settings'

/** One icon per preference. A theme without one falls back to the palette dot. */
const ICONS: Record<string, LucideIcon> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
  pink: Heart,
}

export function ThemeToggle({
  current,
  className,
}: {
  current: ThemePreference
  className?: string
}) {
  const t = useTranslations('common')
  const [pending, startTransition] = useTransition()

  const apply = (value: ThemePreference) => {
    // Paint immediately, persist in the background — the toggle must feel instant.
    const root = document.documentElement
    const id =
      value === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : value

    root.setAttribute('data-theme-pref', value)
    root.setAttribute('data-theme', id)
    root.classList.toggle('dark', DARK_THEME_IDS.includes(id))
    startTransition(() => setTheme(value))
  }

  return (
    <div
      className={cn(
        'glass flex items-center gap-0.5 rounded-full p-0.5',
        className,
      )}
      role="group"
      aria-label={t('theme')}
    >
      {THEME_PREFERENCES.map((value) => {
        const Icon = ICONS[value] ?? Monitor
        const label = t(value === 'system' ? 'themeSystem' : `theme${cap(value)}`)

        return (
          <button
            key={value}
            type="button"
            disabled={pending}
            aria-pressed={current === value}
            title={label}
            aria-label={label}
            onClick={() => apply(value)}
            className={cn(
              'flex size-7 items-center justify-center rounded-full transition-colors',
              current === value
                ? 'bg-surface text-text shadow-[var(--shadow-card)]'
                : 'text-text-subtle hover:text-text',
            )}
          >
            <Icon className="size-3.5" />
          </button>
        )
      })}
    </div>
  )
}

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
