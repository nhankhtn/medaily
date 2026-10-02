'use client'

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { addDays, fromISODate, type ISODate } from '@/lib/dates'
import { PATHS } from '@/lib/paths'
import { useShortcut } from '@/features/shortcuts/provider'
import { setDayDirection } from './day-events'

const SWIPE_PX = 70
/** How much of the finger the page follows; far less toward a future that does not exist. */
const FOLLOW = 0.35
const RUBBER = 0.12

/**
 * Arrows, a date picker, `[` / `]` and swipe — the same day-hopping affordance
 * on every input method (spec 6.4).
 */
export function DateNav({ date, today }: { date: ISODate; today: ISODate }) {
  const router = useRouter()
  const t = useTranslations('common')
  const td = useTranslations('daily')
  const format = useFormatter()
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const go = (target: ISODate) => {
    if (target > today) return
    setDayDirection(target > date ? 1 : target < date ? -1 : 0)
    router.push(target === today ? '/daily' : PATHS.dailyOn(target))
  }

  useShortcut('prevDay', () => go(addDays(date, -1)))
  useShortcut('nextDay', () => go(addDays(date, 1)))
  useShortcut('today', () => go(today))

  useEffect(() => {
    const page = () => document.querySelector<HTMLElement>('[data-daily-swipe]')
    const settle = () => {
      const node = page()
      if (!node) return
      node.style.transition = 'transform 0.25s var(--ease-out-soft)'
      node.style.transform = ''
    }

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      // A chip row scrolls sideways; swiping it must not change the day.
      const inScroller = (event.target as Element | null)?.closest?.(
        '.overflow-x-auto, [data-no-swipe]',
      )
      touchStart.current = touch && !inScroller ? { x: touch.clientX, y: touch.clientY } : null
    }
    const onMove = (event: TouchEvent) => {
      const start = touchStart.current
      const touch = event.touches[0]
      const node = page()
      if (!start || !touch || !node) return
      const dx = touch.clientX - start.x
      if (Math.abs(touch.clientY - start.y) > Math.abs(dx)) return
      const towardFuture = dx < 0 && addDays(date, 1) > today
      node.style.transition = 'none'
      node.style.transform = `translateX(${dx * (towardFuture ? RUBBER : FOLLOW)}px)`
    }
    const onEnd = (event: TouchEvent) => {
      const start = touchStart.current
      const touch = event.changedTouches[0]
      touchStart.current = null
      settle()
      if (!start || !touch) return
      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      if (Math.abs(dx) < SWIPE_PX || Math.abs(dy) > 50) return
      const target = addDays(date, dx > 0 ? -1 : 1)
      if (target > today) {
        toast(td('futureNudge'))
        return
      }
      go(target)
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', settle, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', settle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, today])

  const isToday = date === today
  const nextDisabled = addDays(date, 1) > today

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="iconSm"
        aria-label={t('previous')}
        onClick={() => go(addDays(date, -1))}
      >
        <ChevronLeft className="size-4" />
      </Button>

      <div className="relative">
        <div
          aria-hidden
          className="glass border-border-strong flex h-9 items-center gap-2 rounded-[var(--radius)] px-3 text-sm"
        >
          <CalendarDays className="text-text-subtle size-4" />
          <span className="tabular-nums">
            {isToday ? t('today') : format.dateTime(fromISODate(date), 'dayMonth')}
          </span>
        </div>

        <input
          type="date"
          value={date}
          max={today}
          aria-label={t('pickDate')}
          onChange={(event) => event.target.value && go(event.target.value)}
          className={
            // Hair of opacity + stretched indicator — `opacity-0` collapses
            // the WebKit hit region to the tiny calendar glyph (finance DateInput
            // uses the same trick).
            'absolute inset-0 z-10 cursor-pointer opacity-[0.01] ' +
            '[&::-webkit-calendar-picker-indicator]:absolute ' +
            '[&::-webkit-calendar-picker-indicator]:inset-0 ' +
            '[&::-webkit-calendar-picker-indicator]:h-full ' +
            '[&::-webkit-calendar-picker-indicator]:w-full ' +
            '[&::-webkit-calendar-picker-indicator]:cursor-pointer'
          }
        />
      </div>

      <Button
        variant="outline"
        size="iconSm"
        aria-label={t('next')}
        disabled={nextDisabled}
        onClick={() => go(addDays(date, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>

      {!isToday ? (
        <Button variant="ghost" size="sm" onClick={() => go(today)}>
          {t('today')}
        </Button>
      ) : null}
    </div>
  )
}
