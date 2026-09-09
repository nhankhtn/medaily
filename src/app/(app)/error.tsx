'use client'

import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

/**
 * Errors from a page stop here, inside the shell, instead of above it.
 *
 * Without this boundary the nearest one was the root `error.tsx`, which sits
 * outside the shell: a page that could not reach the database took the
 * sidebar, header and navigation down with it and left a blank 500. Here the
 * shell survives and only the failed panel is replaced, so every other module
 * is still one click away.
 */
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
        {/* A plain anchor: this one is a JSON endpoint, not a route. */}
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
