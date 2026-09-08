'use client'

import { CheckCircle2, Loader2, RefreshCw, Undo2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import {
  finalizeReview,
  recomputeReviewSnapshot,
  reopenReview,
  saveReview,
} from '@/server/actions/reviews'
import type { ReviewView } from '@/server/services/reviews'

/**
 * Spec 17.4 — the written fields open pre-seeded from the period's own daily
 * wins and problems, so the user edits rather than facing a blank page.
 */
export function ReviewEditor({ view }: { view: ReviewView }) {
  const t = useTranslations('reviews')
  const tc = useTranslations('common')
  const [pending, startTransition] = useTransition()

  const [fields, setFields] = useState({
    whatWorked: view.row?.whatWorked ?? '',
    whatDidnt: view.row?.whatDidnt ?? '',
    changeNext: view.row?.changeNext ?? '',
    topPriority: view.row?.topPriority ?? '',
    reflection: view.row?.reflection ?? '',
  })

  const payload = { period: view.period, key: view.key, ...fields }

  const set = (key: keyof typeof fields, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }))

  const seed = (key: 'whatWorked' | 'whatDidnt', lines: string[]) => {
    const bullets = lines.map((line) => `- ${line}`).join('\n')
    set(key, fields[key] ? `${fields[key]}\n${bullets}` : bullets)
  }

  const run = (action: 'save' | 'finalize') =>
    startTransition(async () => {
      const result = action === 'save' ? await saveReview(payload) : await finalizeReview(payload)
      if (!result.ok) {
        toast.error(tc('error'))
        return
      }
      toast.success(action === 'save' ? t('saved') : t('finalized'))
    })

  return (
    <div className="space-y-4">
      {view.previousPriority ? (
        <div className="rounded-[var(--radius)] border border-border-base bg-accent-soft px-4 py-3">
          <p className="text-sm">{t('previousPriority', { priority: view.previousPriority })}</p>
          <p className="mt-0.5 text-xs text-text-muted">{t('previousPriorityAsk')}</p>
        </div>
      ) : null}

      <FieldBlock
        label={t('whatWorked')}
        value={fields.whatWorked}
        onChange={(value) => set('whatWorked', value)}
        disabled={view.finalized}
        seeds={view.suggestedWins}
        seedLabel={t('seedWins')}
        seedAction={t('useSeeds')}
        onSeed={() => seed('whatWorked', view.suggestedWins)}
      />

      <FieldBlock
        label={t('whatDidnt')}
        value={fields.whatDidnt}
        onChange={(value) => set('whatDidnt', value)}
        disabled={view.finalized}
        seeds={view.suggestedProblems}
        seedLabel={t('seedProblems')}
        seedAction={t('useSeeds')}
        onSeed={() => seed('whatDidnt', view.suggestedProblems)}
      />

      <FieldBlock
        label={t('changeNext')}
        value={fields.changeNext}
        onChange={(value) => set('changeNext', value)}
        disabled={view.finalized}
      />

      <FieldBlock
        label={t('topPriority')}
        value={fields.topPriority}
        onChange={(value) => set('topPriority', value)}
        disabled={view.finalized}
        rows={2}
      />

      <FieldBlock
        label={t('reflection')}
        value={fields.reflection}
        onChange={(value) => set('reflection', value)}
        disabled={view.finalized}
        rows={4}
      />

      <div className="flex flex-wrap gap-2">
        {view.finalized ? (
          <>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await reopenReview({ period: view.period, key: view.key })
                  toast.success(t('reopen'))
                })
              }
            >
              <Undo2 className="size-4" />
              {t('reopen')}
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await recomputeReviewSnapshot({ period: view.period, key: view.key })
                  toast.success(t('recompute'))
                })
              }
            >
              <RefreshCw className="size-4" />
              {t('recompute')}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" disabled={pending} onClick={() => run('save')}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t('save')}
            </Button>
            <Button disabled={pending} onClick={() => run('finalize')}>
              <CheckCircle2 className="size-4" />
              {t('finalize')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function FieldBlock({
  label,
  value,
  onChange,
  disabled,
  rows = 3,
  seeds,
  seedLabel,
  seedAction,
  onSeed,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  rows?: number
  seeds?: string[]
  seedLabel?: string
  seedAction?: string
  onSeed?: () => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {seeds && seeds.length > 0 && !disabled ? (
          <button
            type="button"
            onClick={onSeed}
            className="text-xs text-accent hover:underline"
            title={seeds.slice(0, 5).join(' · ')}
          >
            {seedLabel} · {seedAction} ({seeds.length})
          </button>
        ) : null}
      </div>
      <Textarea
        rows={rows}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
