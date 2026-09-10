'use client'

import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('common')

  useEffect(() => {
    console.error('[app] this route failed to render:', error)
  }, [error])

  return (
    <section className="flex flex-col items-start gap-4 py-12">
      <div>
        <p className="text-lg font-medium">{t('loadFailed')}</p>
        <p className="mt-1 max-w-prose text-sm text-text-muted">{t('loadFailedHint')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={reset}>{t('retry')}</Button>
        <Button asChild variant="outline">
          <a href="/api/health">{t('checkHealth')}</a>
        </Button>
      </div>

      {error.digest ? (
        <p className="text-xs text-text-subtle">
          Digest {error.digest} — {t('seeServerLogs')}
        </p>
      ) : null}
    </section>
  )
}
