'use client'

import { RotateCw } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { PATHS } from '@/lib/paths'
import { useRequestId } from '@/components/shell/request-id'
import { reportClientError } from '@/server/actions/alerts'

/**
 * What a person sees when a page fails. Diagnostics — the digest, the endpoint
 * that explains the cause — go to the console, where whoever is fixing it will
 * look. On screen there is one thing to read and one thing to press.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('common')
  const requestId = useRequestId()

  useEffect(() => {
    const marks = [requestId ? `req ${requestId}` : null, error.digest ? `digest ${error.digest}` : null]
      .filter(Boolean)
      .join(', ')
    console.error(
      `[app] this route failed to render${marks ? ` (${marks})` : ''};`,
      'open /api/health for the cause:',
      error,
    )
    void reportClientError({
      message: error.message,
      digest: error.digest ?? null,
      requestId,
      path: window.location.pathname,
    })
  }, [error, requestId])

  return (
    <section className="flex flex-col items-start gap-4 py-12">
      <div>
        <p className="text-lg font-medium">{t('loadFailed')}</p>
        <p className="mt-1 max-w-prose text-sm text-text-muted">{t('loadFailedHint')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={reset}>
          <RotateCw className="size-4" />
          {t('retry')}
        </Button>
        <Button asChild variant="ghost">
          <Link href={PATHS.home}>{t('backHome')}</Link>
        </Button>
      </div>
    </section>
  )
}
