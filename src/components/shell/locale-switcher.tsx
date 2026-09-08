'use client'

import { Languages } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { LOCALES, type Locale } from '@/i18n/config'
import { setLocale } from '@/server/actions/settings'
import { cn } from '@/lib/utils'

/** Instant switch, no reload, no lost form state (spec 21). */
export function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const active = useLocale() as Locale
  const t = useTranslations('common')
  const [pending, startTransition] = useTransition()

  return (
    <div
      className="flex items-center gap-1 rounded-full border border-border-base bg-surface-2 p-0.5"
      role="group"
      aria-label={t('language')}
    >
      {compact ? <Languages className="ml-1.5 size-3.5 text-text-subtle" aria-hidden /> : null}
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          disabled={pending}
          aria-pressed={active === locale}
          onClick={() => startTransition(() => setLocale(locale))}
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-semibold uppercase transition-colors',
            active === locale
              ? 'bg-surface text-text shadow-[var(--shadow-card)]'
              : 'text-text-subtle hover:text-text',
            pending && 'opacity-60',
          )}
        >
          {locale}
        </button>
      ))}
    </div>
  )
}
