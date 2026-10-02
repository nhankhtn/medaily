'use client'

import { Heart, Moon, Mountain, Sun, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { flushSync } from 'react-dom'
import { SegmentedSwitch } from '@/components/ui/segmented-switch'
import {
  DARK_THEME_IDS,
  THEME_PREFERENCES,
  type ThemePreference,
} from '@/lib/themes'
import { setTheme } from '@/server/actions/settings'

/** One icon per preference. A theme without one falls back to the sun. */
const ICONS: Record<ThemePreference, LucideIcon> = {
  light: Sun,
  dark: Moon,
  pink: Heart,
  meadow: Mountain,
}

export function ThemeToggle({
  current,
  className,
}: {
  current: ThemePreference
  className?: string
}) {
  const t = useTranslations('common')
  const [pending, startTransition] = useTransition()
  // `current` only moves once the server action revalidates; until then the pill follows the click.
  const [picked, setPicked] = useState(current)
  const selected = pending ? picked : current

  const apply = (value: ThemePreference, origin: HTMLElement) => {
    // Paint immediately, persist in the background — the toggle must feel instant.
    const root = document.documentElement
    const paint = () => {
      flushSync(() => setPicked(value))
      root.setAttribute('data-theme-pref', value)
      root.setAttribute('data-theme', value)
      root.classList.toggle('dark', DARK_THEME_IDS.includes(value))
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (typeof document.startViewTransition !== 'function' || reduced || value === selected) {
      paint()
    } else {
      // The new palette grows out of the button as a circle, sized to reach the farthest corner.
      const rect = origin.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
      root.classList.add('ui-theme-reveal')
      const transition = document.startViewTransition(paint)
      // Driven from JS, not keyframes: Safari does not hand custom properties to the
      // ::view-transition pseudo-elements, so a var()-positioned circle never grew there.
      void transition.ready.then(() => {
        root.animate(
          {
            clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
          },
          {
            duration: 550,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
            pseudoElement: '::view-transition-new(root)',
          },
        )
      })
      void transition.finished.finally(() => root.classList.remove('ui-theme-reveal'))
    }

    startTransition(() => setTheme(value))
  }

  return (
    <SegmentedSwitch
      options={THEME_PREFERENCES.map((value) => {
        const Icon = ICONS[value]
        const label = t(`theme${cap(value)}`)
        return { value, label: <Icon className="size-3.5" />, ariaLabel: label, title: label }
      })}
      value={selected}
      onChange={apply}
      ariaLabel={t('theme')}
      disabled={pending}
      className={className}
      itemClassName="size-7"
    />
  )
}

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
