'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { setTheme } from '@/server/actions/settings'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'light', icon: Sun, labelKey: 'themeLight' },
  { value: 'dark', icon: Moon, labelKey: 'themeDark' },
  { value: 'system', icon: Monitor, labelKey: 'themeSystem' },
] as const

export function ThemeToggle({ current }: { current: 'light' | 'dark' | 'system' }) {
  const t = useTranslations('common')
  const [pending, startTransition] = useTransition()

  const apply = (value: 'light' | 'dark' | 'system') => {
    // Paint immediately, persist in the background — the toggle must feel instant.
    const root = document.documentElement
    const dark =
      value === 'dark' ||
      (value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    root.classList.toggle('dark', dark)
    startTransition(() => setTheme(value))
  }

  return (
    <div
      className="hidden items-center gap-0.5 rounded-full border border-border-base bg-surface-2 p-0.5 sm:flex"
      role="group"
      aria-label={t('theme')}
    >
      {OPTIONS.map(({ value, icon: Icon, labelKey }) => (
        <button
          key={value}
          type="button"
          disabled={pending}
          aria-pressed={current === value}
          title={t(labelKey)}
          aria-label={t(labelKey)}
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
      ))}
    </div>
  )
}
