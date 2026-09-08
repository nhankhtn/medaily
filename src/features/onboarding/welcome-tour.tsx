'use client'

import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  Home,
  Repeat,
  Settings,
  Sparkles,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { TOUR_STEPS, type TourStepKey } from '@/lib/onboarding'
import { markTourSeen } from '@/server/actions/onboarding'
import { cn } from '@/lib/utils'

const ICONS: Record<TourStepKey, LucideIcon> = {
  log: ClipboardList,
  dashboard: Home,
  habitsGoals: Repeat,
  insight: BarChart3,
  life: Wallet,
  settings: Settings,
}

/**
 * A short introduction, one screen per area, that names what each part is for
 * and where to start. Skipping and finishing do the same thing: it never opens
 * by itself again (spec 6.5 — first run should explain, not obstruct).
 */
export function WelcomeTour({ open: initiallyOpen }: { open: boolean }) {
  const t = useTranslations('onboarding')
  const [open, setOpen] = useState(initiallyOpen)
  const [index, setIndex] = useState(0)
  const [, startTransition] = useTransition()

  const step = TOUR_STEPS[index]
  const isLast = index === TOUR_STEPS.length - 1

  const close = () => {
    setOpen(false)
    startTransition(() => void markTourSeen())
  }

  // Arrow keys move through the steps; Escape closes and counts as seen.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') setIndex((prev) => Math.min(TOUR_STEPS.length - 1, prev + 1))
      if (event.key === 'ArrowLeft') setIndex((prev) => Math.max(0, prev - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!step) return null
  const Icon = ICONS[step.key]

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      <DialogContent title={t(`tour.${step.key}.title`)} description={t('welcome')}>
        <div className="space-y-4">
          <div className="flex size-11 items-center justify-center rounded-[var(--radius)] bg-accent-soft">
            <Icon className="size-5 text-accent" />
          </div>

          <p className="max-w-prose text-sm leading-relaxed text-text-muted">
            {t(`tour.${step.key}.body`)}
          </p>

          <Button asChild variant="outline" size="sm" onClick={close}>
            <Link href={step.href}>
              {t(`tour.${step.key}.cta`)}
              <ArrowRight className="size-4" />
            </Link>
          </Button>

          <div className="flex items-center justify-between gap-3 border-t border-border-base pt-3">
            {/* Dots double as a progress readout and as direct navigation. */}
            <div className="flex items-center gap-1.5">
              {TOUR_STEPS.map((candidate, candidateIndex) => (
                <button
                  key={candidate.key}
                  type="button"
                  aria-label={t('stepOf', { current: candidateIndex + 1, total: TOUR_STEPS.length })}
                  aria-current={candidateIndex === index}
                  onClick={() => setIndex(candidateIndex)}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    candidateIndex === index ? 'w-6 bg-accent' : 'w-1.5 bg-border-strong',
                  )}
                />
              ))}
              <span className="ml-2 text-xs tabular-nums text-text-subtle">
                {t('stepOf', { current: index + 1, total: TOUR_STEPS.length })}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {index > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => setIndex(index - 1)}>
                  {t('back')}
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={close}>
                  {t('skip')}
                </Button>
              )}

              {isLast ? (
                <Button asChild size="sm" onClick={close}>
                  <Link href="/daily">
                    <Sparkles className="size-4" />
                    {t('finish')}
                  </Link>
                </Button>
              ) : (
                <Button size="sm" onClick={() => setIndex(index + 1)}>
                  {t('next')}
                  <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
