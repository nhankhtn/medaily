'use client'

import { Languages } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { SegmentedSwitch } from '@/components/ui/segmented-switch'
import { LOCALES, type Locale } from '@/i18n/config'
import { setLocale } from '@/server/actions/settings'
import { cn } from '@/lib/utils'

/** Instant switch, no reload, no lost form state (spec 21). Tap or drag the thumb. */
export function LocaleSwitcher({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  const active = useLocale() as Locale
  const t = useTranslations('common')
  const [pending, startTransition] = useTransition()
  // The locale only changes once the action revalidates; the thumb follows the choice now.
  const [picked, setPicked] = useState(active)

  return (
    <SegmentedSwitch
      options={LOCALES.map((locale) => ({ value: locale, label: locale }))}
      value={pending ? picked : active}
      onChange={(locale) => {
        setPicked(locale)
        startTransition(() => setLocale(locale))
      }}
      ariaLabel={t('language')}
      disabled={pending}
      leading={
        compact ? <Languages className="text-text-subtle ml-1.5 size-3.5" aria-hidden /> : null
      }
      className={cn(pending && 'opacity-80', className)}
      itemClassName="px-2.5 py-1 text-xs font-semibold uppercase"
    />
  )
}
