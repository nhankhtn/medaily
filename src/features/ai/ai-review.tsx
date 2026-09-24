'use client'

import { Loader2, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import { generateReview } from '@/server/actions/ai'

/**
 * Offered when the AI service is configured. The narrative itself is the
 * product; no privacy footnote or model/date chrome.
 */
/** Waiting a moment fixes one of these and not the other, so they read apart. */
const MESSAGE: Partial<Record<string, string>> = {
  disabled: 'disabled',
  rate_limited: 'rateLimited',
}

export function AiReview({
  period,
  periodKey,
  enabled,
  existing,
}: {
  period: 'weekly' | 'monthly'
  periodKey: string
  enabled: boolean
  existing: string | null
}) {
  const t = useTranslations('ai')
  const [content, setContent] = useState(existing)
  const [pending, startTransition] = useTransition()

  if (!enabled) {
    return <p className="text-sm text-text-subtle">{t('disabled')}</p>
  }

  const run = () =>
    startTransition(async () => {
      const result = await generateReview({ period, key: periodKey })
      if (!result.ok) {
        toast.error(t(MESSAGE[result.error] ?? 'failed'))
        return
      }
      setContent(result.contentMd)
    })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={content ? 'outline' : 'primary'} disabled={pending} onClick={run}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {pending ? t('generating') : content ? t('regenerate') : t('generate')}
        </Button>
      </div>

      {content ? (
        <div className="glass rounded-[var(--radius)] p-4">
          <Markdown>{content}</Markdown>
        </div>
      ) : (
        <p className="text-sm text-text-subtle">{t('empty')}</p>
      )}
    </div>
  )
}
