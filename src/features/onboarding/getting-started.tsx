'use client'

import { ArrowRight, Check, X } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { Checklist } from '@/lib/onboarding'
import { dismissChecklist } from '@/server/actions/onboarding'
import { cn } from '@/lib/utils'

/**
 * The answer to "where do I start?", derived from the data rather than from
 * stored flags: the first unfinished step is marked, progress is real, and the
 * card disappears once every step is met — or when the user hides it.
 */
export function GettingStarted({ checklist }: { checklist: Checklist }) {
  const t = useTranslations('onboarding.checklist')
  const [hidden, setHidden] = useState(false)
  const [, startTransition] = useTransition()

  if (hidden) return null

  const hide = () => {
    setHidden(true)
    startTransition(() => void dismissChecklist())
  }

  return (
    <section className="rounded-[var(--radius)] border border-accent bg-accent-soft/40 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t('title')}</h2>
          <p className="mt-0.5 text-xs tabular-nums text-text-muted">
            {t('progress', { done: checklist.completedCount, total: checklist.total })}
          </p>
        </div>
        <button
          type="button"
          onClick={hide}
          aria-label={t('dismiss')}
          title={t('dismiss')}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-text-subtle hover:bg-surface hover:text-text"
        >
          <X className="size-4" />
        </button>
      </header>

      <Progress
        className="mt-3"
        value={(checklist.completedCount / checklist.total) * 100}
        tone="accent"
        label={t('title')}
      />

      <ol className="mt-3 space-y-1">
        {checklist.steps.map((step) => {
          const isNext = checklist.nextStep?.key === step.key

          return (
            <li key={step.key}>
              <Link
                href={step.href}
                className={cn(
                  'flex items-center gap-3 rounded-[var(--radius)] px-2 py-2 transition-colors',
                  step.done ? 'opacity-60' : 'hover:bg-surface',
                  isNext && 'bg-surface',
                )}
              >
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border',
                    step.done ? 'border-transparent bg-good text-white' : 'border-border-strong',
                  )}
                >
                  {step.done ? <Check className="size-3" /> : null}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate text-sm',
                      step.done ? 'text-text-muted line-through' : 'font-medium',
                    )}
                  >
                    {t(`${step.key}.title`)}
                  </span>
                  {!step.done ? (
                    <span className="block truncate text-xs text-text-subtle">
                      {t(`${step.key}.hint`)}
                    </span>
                  ) : null}
                </span>

                {/* Multi-step targets show how far along they are. */}
                {!step.done && step.target > 1 ? (
                  <span className="shrink-0 text-xs tabular-nums text-text-subtle">
                    {t('stepProgress', { current: step.current, target: step.target })}
                  </span>
                ) : null}

                {isNext ? (
                  <Badge tone="accent" className="shrink-0">
                    {t('startHere')}
                    <ArrowRight className="size-3" />
                  </Badge>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
