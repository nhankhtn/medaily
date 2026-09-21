'use client'

import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { TOUR_PARAM, TOUR_STEPS, tourHref, tourIndexOf, type TourStep } from '@/lib/onboarding/tour'
import { markTourSeen } from '@/server/actions/onboarding'
import { TOUR_FINISHED_EVENT } from '@/features/settings/install-capability'
import { cn } from '@/lib/utils'

const same = (a: DOMRect | null, b: DOMRect) =>
  a !== null && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height

/**
 * Follows the element a step points at, for as long as the step is showing.
 *
 * It re-queries every frame rather than holding on to the node, which is what
 * makes it survive the page it navigated to still hydrating: React can replace
 * that button underneath us, and a reference captured once would go on
 * measuring a detached node — a rectangle of zeros in the corner of the screen.
 * Re-querying also means scrolling, resizing and a dialog opening need no
 * listeners of their own.
 *
 * It keeps looking for as long as the step is showing rather than giving up on
 * a timer: the heavier pages can take several seconds to arrive over a slow
 * connection, and a step that quietly stopped waiting would point at nothing.
 * Until it finds the target the guide dims the whole page instead, so the step
 * is readable the entire time.
 */
function useTargetRect(selector: string | undefined): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [measuring, setMeasuring] = useState(selector)

  // A new step must not spotlight the last step's rectangle while it looks.
  if (selector !== measuring) {
    setMeasuring(selector)
    setRect(null)
  }

  useEffect(() => {
    if (!selector) return

    let frame = 0
    let last: DOMRect | null = null
    let scrolled = false

    const tick = () => {
      const element = document.querySelector(selector)
      const box = element?.getBoundingClientRect()

      // An element that is in the document but has no box yet is still coming.
      if (box && (box.width > 0 || box.height > 0)) {
        if (!scrolled) {
          scrolled = true
          element?.scrollIntoView({ block: 'center', inline: 'nearest' })
        }
        if (!same(last, box)) {
          last = box
          setRect(box)
        }
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [selector])

  return rect
}

export function TourGuide() {
  const t = useTranslations('onboarding')
  const router = useRouter()
  const params = useSearchParams()
  const index = tourIndexOf(params.get(TOUR_PARAM))
  const step: TourStep | undefined = index >= 0 ? TOUR_STEPS[index] : undefined
  const rect = useTargetRect(step?.target)
  const [card, setCard] = useState<HTMLElement | null>(null)
  const cardHeight = useCardHeight(card, step?.key)

  const leave = useCallback(() => {
    const next = new URLSearchParams(params)
    next.delete(TOUR_PARAM)
    const query = next.toString()
    router.replace(query ? `?${query}` : window.location.pathname)
    void markTourSeen()
    window.dispatchEvent(new Event(TOUR_FINISHED_EVENT))
  }, [params, router])

  const go = useCallback(
    (to: number) => {
      const target = TOUR_STEPS[to]
      if (target) router.push(tourHref(target))
    },
    [router],
  )

  useEffect(() => {
    if (!step) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') leave()
      if (event.key === 'ArrowRight') go(index + 1)
      if (event.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, index, go, leave])

  if (!step) return null

  const isLast = index === TOUR_STEPS.length - 1

  return (
    <>
      {/*
       * The dim is a shadow cast outward from the hole, which is why the page
       * underneath stays clickable: the person can try the button being
       * explained without leaving the tour.
       */}
      {rect ? (
        <div
          aria-hidden
          className="ring-accent pointer-events-none fixed z-60 rounded-[var(--radius)] shadow-[0_0_0_9999px_var(--overlay)] ring-2 transition-all duration-200"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      ) : (
        <div aria-hidden className="bg-overlay fixed inset-0 z-60 backdrop-blur-sm" />
      )}

      <Card
        role="dialog"
        aria-modal="false"
        aria-label={t(`tour.${step.key}.title`)}
        className={cn(
          'fixed z-70 p-4 shadow-xl',
          'inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-auto',
          'sm:w-[22rem]',
        )}
        ref={setCard}
        style={sheetPosition(rect, cardHeight)}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">{t(`tour.${step.key}.title`)}</h2>
          <button
            type="button"
            onClick={leave}
            aria-label={t('skip')}
            className="text-text-subtle hover:text-text -m-1 shrink-0 p-1"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="text-text-muted mt-2 text-sm leading-relaxed">{t(`tour.${step.key}.body`)}</p>

        <div className="border-border-base mt-3 flex items-center justify-between gap-2 border-t pt-3">
          <span className="text-text-subtle text-xs tabular-nums">
            {t('stepOf', { current: index + 1, total: TOUR_STEPS.length })}
          </span>

          <div className="flex items-center gap-1.5">
            {index > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => go(index - 1)}>
                <ArrowLeft className="size-4" />
                {t('back')}
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={leave}>
                {t('skip')}
              </Button>
            )}

            {isLast ? (
              <Button size="sm" onClick={leave}>
                <Sparkles className="size-4" />
                {t('finish')}
              </Button>
            ) : (
              <Button size="sm" onClick={() => go(index + 1)}>
                {t('next')}
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </>
  )
}

/** The card's own height, remeasured whenever its text changes. */
function useCardHeight(card: HTMLElement | null, stepKey: string | undefined): number {
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (!card) return
    const measure = () => setHeight(card.getBoundingClientRect().height)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(card)
    return () => observer.disconnect()
  }, [card, stepKey])

  return height
}

const GAP = 16

/**
 * On a phone the card is a sheet at the bottom and the spotlight scrolls to the
 * middle, so the two never fight for the same space.
 *
 * On a wide screen it sits under the target, or over it when there is no room
 * under — and then it is clamped to the viewport, because a target taller than
 * the screen (a whole form, say) leaves no room either way and the card would
 * otherwise be positioned off the top edge with its heading cut away.
 */
function sheetPosition(rect: DOMRect | null, cardHeight: number): React.CSSProperties | undefined {
  if (typeof window === 'undefined' || window.innerWidth < 640) return undefined
  if (!rect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

  const viewport = window.innerHeight
  const height = cardHeight || 220
  const rightEdge = window.innerWidth - 368

  const under = rect.bottom + GAP
  const over = rect.top - GAP - height
  const wanted = viewport - under >= height + GAP ? under : over
  const top = Math.min(Math.max(wanted, GAP), Math.max(viewport - height - GAP, GAP))

  // Nowhere clear to sit means it lands on the target. Keep to the right, where
  // a form has its values rather than the labels that say what they are.
  const overlaps = top < rect.bottom && top + height > rect.top

  return { top, left: overlaps ? rightEdge : Math.min(Math.max(rect.left, GAP), rightEdge) }
}
