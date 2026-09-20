'use client'

import { MoreHorizontal, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { BOTTOM_NAV_ITEMS, MORE_NAV_ITEMS } from '@/lib/nav'
import { cn } from '@/lib/utils'
import { SignOutButton } from './sign-out-button'

/** Five destinations, thumb-reachable, everything else under More (spec 22.3). */
export function BottomNav() {
  const pathname = usePathname()
  const t = useTranslations('nav')
  // The sheet remembers which route it was opened on, so navigating closes it
  // without an effect that would re-render the whole bar.
  const [openedOn, setOpenedOn] = useState<string | null>(null)
  const moreOpen = openedOn === pathname
  const setMoreOpen = (open: boolean) => setOpenedOn(open ? pathname : null)

  useEffect(() => {
    if (!moreOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenedOn(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])

  const moreActive = MORE_NAV_ITEMS.some((item) => pathname.startsWith(item.href))

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-40 bg-black/20 md:hidden dark:bg-black/40">
          {/*
           * No backdrop-blur on this layer — a parent filter would freeze the
           * page into a flat grey, and every glass-chip would only sample that
           * milky sheet (reading as opaque white tiles). Chips blur the live
           * page themselves.
           */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{ background: 'var(--bg-atmosphere)' }}
          />
          <div className="relative flex items-center justify-between pr-[max(1.25rem,env(safe-area-inset-right,0px))] pl-[max(1.25rem,env(safe-area-inset-left,0px))] pt-[env(safe-area-inset-top,0px)]">
            <span className="flex h-14 items-center text-lg font-semibold">{t('more')}</span>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              aria-label={t('collapse')}
              className="glass-chip flex size-10 items-center justify-center rounded-full"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="relative h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))] overflow-y-auto overscroll-contain pt-2 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] pl-[max(1.25rem,env(safe-area-inset-left,0px))] pr-[max(1.25rem,env(safe-area-inset-right,0px))]">
            <div className="grid grid-cols-3 gap-3">
              {MORE_NAV_ITEMS.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="glass-chip flex aspect-square flex-col items-center justify-center gap-2 rounded-[1.35rem] p-2 text-center"
                >
                  <item.icon className="size-6 text-accent" />
                  <span className="text-xs leading-tight text-text-muted">{t(item.key)}</span>
                </Link>
              ))}
              {/* Language and theme live on the settings page, one tile away. */}
              <SignOutButton variant="card" />
            </div>
          </div>
        </div>
      ) : null}

      {/* Full-bleed chrome under the home indicator. Fill is on this fixed
          node so Safari can sample it for the bottom ears (absolute children
          are ignored by the tint algorithm). */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-[var(--surface-solid)] md:hidden"
        style={{ height: 'env(safe-area-inset-bottom, 0px)' }}
      />

      {/* Floating dock — glass on the fixed root so Safari tints bottom chrome. */}
      <nav
        className={cn(
          'glass-chip fixed z-50 md:hidden',
          'right-[max(0.75rem,env(safe-area-inset-right,0px))] left-[max(0.75rem,env(safe-area-inset-left,0px))]',
          'bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))]',
          'rounded-[1.75rem] px-1.5 py-1.5',
        )}
        aria-label={t('groupCore')}
      >
        <ul className="grid grid-cols-5">
          {BOTTOM_NAV_ITEMS.map((item) => {
            const active =
              !moreOpen && (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href))
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-12 flex-col items-center justify-center gap-0.5 rounded-2xl',
                    active ? 'text-accent' : 'text-text-subtle',
                  )}
                >
                  <item.icon className="size-5" />
                  <span className="text-[10px] leading-none">
                    {item.key === 'daily' ? t('log') : t(item.key)}
                  </span>
                </Link>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(!moreOpen)}
              aria-expanded={moreOpen}
              className={cn(
                'flex h-12 w-full flex-col items-center justify-center gap-0.5 rounded-2xl',
                moreOpen || moreActive ? 'text-accent' : 'text-text-subtle',
              )}
            >
              <MoreHorizontal className="size-5" />
              <span className="text-[10px] leading-none">{t('more')}</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  )
}
