'use client'

import { Loader2, Sparkles } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import { generateReview } from '@/server/actions/ai'

/**
 * Always labelled as generated, always shown with the model and date, and only
 * offered when a key is configured (spec 29, 35 §14).
 */
export function AiReview({
  period,
  periodKey,
  enabled,
  existing,
}: {
  period: 'weekly' | 'monthly'
  periodKey: string
  enabled: boolean
  existing: { contentMd: string; model: string; createdAt: string } | null
}) {
  const t = useTranslations('ai')
  const format = useFormatter()
  const [content, setContent] = useState(existing?.contentMd ?? null)
  const [meta, setMeta] = useState(existing)
  const [pending, startTransition] = useTransition()

  if (!enabled) {
    return <p className="text-sm text-text-subtle">{t('disabled')}</p>
  }

  const run = () =>
    startTransition(async () => {
      const result = await generateReview({ period, key: periodKey })
      if (!result.ok) {
        toast.error(result.error === 'disabled' ? t('disabled') : t('failed'))
        return
      }
      setContent(result.contentMd)
      setMeta({ contentMd: result.contentMd, model: 'claude-opus-5', createdAt: new Date().toISOString() })
    })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={content ? 'outline' : 'primary'} disabled={pending} onClick={run}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {pending ? t('generating') : content ? t('regenerate') : t('generate')}
        </Button>
        {content ? <Badge tone="accent">{t('label')}</Badge> : null}
      </div>

      {content ? (
        <div className="rounded-[var(--radius)] border border-border-base bg-surface-2 p-4">
          <Markdown>{content}</Markdown>
          {meta ? (
            <p className="mt-3 border-t border-border-base pt-2 text-xs text-text-subtle">
              {t('generatedBy', {
                model: meta.model,
                date: format.dateTime(new Date(meta.createdAt), {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-text-subtle">{t('empty')}</p>
      )}

      <p className="text-xs leading-snug text-text-subtle">{t('privacy')}</p>
    </div>
  )
}
