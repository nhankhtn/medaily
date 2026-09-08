'use client'

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { addDays, fromISODate, type ISODate } from '@/lib/dates'

/**
 * Arrows, a date picker, `[` / `]` and swipe — the same day-hopping affordance
 * on every input method (spec 6.4).
 */
export function DateNav({ date, today }: { date: ISODate; today: ISODate }) {
  const router = useRouter()
  const t = useTranslations('common')
  const format = useFormatter()
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const go = (target: ISODate) => {
    if (target > today) return
    router.push(target === today ? '/daily' : `/daily/${target}`)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === '[') go(addDays(date, -1))
      if (event.key === ']') go(addDays(date, 1))
      if (event.key === 't') go(today)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, today])

  useEffect(() => {
    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY }
    }
    const onEnd = (event: TouchEvent) => {
      const start = touchStart.current
      const touch = event.changedTouches[0]
      touchStart.current = null
      if (!start || !touch) return
      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      if (Math.abs(dx) < 70 || Math.abs(dy) > 50) return
      go(addDays(date, dx > 0 ? -1 : 1))
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
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

      <label className="relative flex h-9 cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-border-strong px-3 text-sm hover:bg-surface-2">
        <CalendarDays className="size-4 text-text-subtle" />
        <span className="tabular-nums">
          {isToday
            ? t('today')
            : format.dateTime(fromISODate(date), { day: 'numeric', month: 'short' })}
        </span>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(event) => event.target.value && go(event.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={t('today')}
        />
      </label>

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
