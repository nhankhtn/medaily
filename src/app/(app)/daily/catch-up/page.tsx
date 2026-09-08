import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CatchUpGrid } from '@/features/daily/catch-up-grid'
import { today } from '@/lib/dates'
import { findMissingDays } from '@/server/services/daily'
import { getDayContext } from '@/server/services/settings'

export default async function CatchUpPage() {
  const [t, ctx] = await Promise.all([getTranslations('daily.catchUp'), getDayContext()])
  const missing = await findMissingDays(today(ctx), 14)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="iconSm">
          <Link href="/daily" aria-label="back">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
      </div>

      {missing.length === 0 ? (
        <p className="text-sm text-text-muted">—</p>
      ) : (
        <CatchUpGrid dates={missing} />
      )}
    </div>
  )
}
