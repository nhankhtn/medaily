import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CatchUpGrid } from '@/features/daily/catch-up-grid'
import { today } from '@/lib/dates'
import { PATHS } from '@/lib/paths'
import { findMissingDays } from '@/server/services/daily'
import { getDayContext, getSettings } from '@/server/services/settings'

export default async function CatchUpPage() {
  const [t, ctx, settings] = await Promise.all([
    getTranslations('daily.catchUp'),
    getDayContext(),
    getSettings(),
  ])
  const missing = await findMissingDays(today(ctx), 14)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="iconSm">
          <Link href={PATHS.daily} aria-label="back">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
      </div>

      {missing.length === 0 ? (
        <p className="text-text-muted text-sm">—</p>
      ) : (
        <CatchUpGrid dates={missing} hiddenFields={settings.hiddenDailyFields} />
      )}
    </div>
  )
}
