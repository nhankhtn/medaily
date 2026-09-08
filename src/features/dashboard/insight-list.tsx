'use client'

import { AlertTriangle, ChevronRight, Clock, PartyPopper, X } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import type { DashboardInsight } from '@/server/services/dashboard'
import { dismiss, snooze } from '@/server/actions/insights'
import { cn } from '@/lib/utils'

/**
 * Warnings are factual and actionable, capped at three, each linking to the
 * screen where something can be done — and always paired with a win when one
 * exists (spec 18.4–18.5). One badly phrased warning is enough to make someone
 * stop logging.
 */
export function InsightList({ insights }: { insights: DashboardInsight[] }) {
  const t = useTranslations('insights')
  const tc = useTranslations('common')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  const visible = insights.filter((insight) => !insight.id || !hidden.has(insight.id))

  if (visible.length === 0) {
    return <p className="px-4 pb-4 text-sm text-text-subtle">{t('empty')}</p>
  }

  const hide = (id: string, action: 'dismiss' | 'snooze') => {
    setHidden((prev) => new Set(prev).add(id))
    startTransition(() => {
      void (action === 'dismiss' ? dismiss(id) : snooze(id))
    })
  }

  return (
    <ul className="space-y-2 px-4 pb-4">
      {visible.map((insight) => {
        const win = insight.severity === 'win'
        const Icon = win ? PartyPopper : AlertTriangle

        return (
          <li
            key={insight.kind + (insight.id ?? '')}
            className={cn(
              'flex items-start gap-2.5 rounded-[var(--radius)] border p-3',
              win
                ? 'border-transparent bg-good-soft'
                : insight.severity === 'high'
                  ? 'border-transparent bg-bad-soft'
                  : 'border-border-base bg-surface-2',
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 size-4 shrink-0',
                win ? 'text-good' : insight.severity === 'high' ? 'text-bad' : 'text-warn',
              )}
            />

            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug text-text">
                {t(insight.payload.messageKey, insight.payload.values)}
              </p>
              <div className="mt-1 flex items-center gap-3 text-xs text-text-subtle">
                {insight.payload.n ? <span>{t('sampleSize', { n: insight.payload.n })}</span> : null}
                {insight.payload.href ? (
                  <Link
                    href={insight.payload.href}
                    className="inline-flex items-center gap-0.5 text-accent hover:underline"
                  >
                    {tc('showMore')}
                    <ChevronRight className="size-3" />
                  </Link>
                ) : null}
              </div>
            </div>

            {insight.id && !win ? (
              <div className="flex shrink-0 gap-0.5">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => hide(insight.id as string, 'snooze')}
                  title={tc('snooze')}
                  aria-label={tc('snooze')}
                  className="flex size-7 items-center justify-center rounded-md text-text-subtle hover:bg-surface hover:text-text"
                >
                  <Clock className="size-3.5" />
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => hide(insight.id as string, 'dismiss')}
                  title={tc('dismiss')}
                  aria-label={tc('dismiss')}
                  className="flex size-7 items-center justify-center rounded-md text-text-subtle hover:bg-surface hover:text-text"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
