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
        <div className="fixed inset-0 z-40 bg-bg/95 backdrop-blur-md md:hidden">
          <div className="flex h-14 items-center justify-between border-b border-border-base px-4">
            <span className="font-semibold">{t('more')}</span>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              aria-label={t('collapse')}
              className="flex size-10 items-center justify-center rounded-full hover:bg-surface-2"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="h-[calc(100dvh-3.5rem)] overflow-y-auto overscroll-contain p-4 pb-24">
            <div className="grid grid-cols-3 gap-3">
              {MORE_NAV_ITEMS.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="glass flex aspect-square flex-col items-center justify-center gap-2 rounded-[var(--radius)] p-2 text-center"
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

      <nav
        className="glass fixed inset-x-0 bottom-0 z-50 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] md:hidden"
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
                    'flex h-14 flex-col items-center justify-center gap-0.5',
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
                'flex h-14 w-full flex-col items-center justify-center gap-0.5',
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
