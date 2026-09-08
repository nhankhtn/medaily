'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

/** Route-level boundary: log server-side, show the user something actionable. */
export default function ErrorBoundary({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('common')
  return (
    <div className="flex flex-col items-start gap-3 py-12">
      <p className="text-lg font-medium">{t('error')}</p>
      <Button onClick={reset} variant="outline">
        {t('retry')}
      </Button>
    </div>
  )
}
