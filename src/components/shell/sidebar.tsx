'use client'

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Logo } from '@/components/brand/logo'
import { NAV_GROUPS, NAV_ITEMS } from '@/lib/nav'
import { PATHS } from '@/lib/paths'
import { cn } from '@/lib/utils'

const COLLAPSE_KEY = 'medaily.sidebar.collapsed'

export function Sidebar() {
  const pathname = usePathname()
  const t = useTranslations('nav')
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Remembered locally: a layout preference, not shared state (spec 23). The
  // read has to happen after mount — localStorage does not exist during SSR,
  // and seeding state from it would desynchronise hydration.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only storage read
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1')
    } catch {
      /* private mode — keep the default */
    }
    setMounted(true)
  }, [])

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <aside
      className={cn(
        // Floating dock on the left — same Control Center inset/radius idea as
        // the mobile bottom nav, still sticky beside the content column.
        'sticky top-3 z-20 ml-3 hidden h-[calc(100dvh-1.5rem)] shrink-0 flex-col overflow-hidden md:flex',
        'glass-chip rounded-[1.75rem]',
        collapsed ? 'w-16' : 'w-60',
        mounted ? 'transition-[width]' : '',
      )}
    >
      <div className="flex h-14 items-center gap-2 px-3">
        <Link
          href={PATHS.home}
          className="flex items-center gap-2 overflow-hidden rounded-md px-1 py-1 font-semibold"
        >
          <Logo size={32} className="shrink-0" />
          {!collapsed ? (
            <span className="font-brand truncate text-sm tracking-tight">Personal OS</span>
          ) : null}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {NAV_GROUPS.map(({ group, labelKey }) => {
          const items = NAV_ITEMS.filter((item) => item.group === group)
          if (items.length === 0) return null
          return (
            <div key={group} className="mb-4">
              {!collapsed ? (
                <p className="px-2 py-1.5 text-[11px] font-semibold tracking-wider text-text-subtle uppercase">
                  {t(labelKey)}
                </p>
              ) : (
                <div className="border-border-base mx-2 my-2 border-t" />
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active =
                    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        title={collapsed ? t(item.key) : undefined}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex h-10 items-center gap-3 rounded-[var(--radius)] px-2.5 text-sm transition-colors',
                          active
                            ? 'bg-accent-soft font-medium text-accent'
                            : 'text-text-muted hover:bg-surface-2 hover:text-text',
                          collapsed && 'justify-center px-0',
                        )}
                      >
                        <item.icon className="size-[18px] shrink-0" />
                        {!collapsed ? (
                          <span className="flex-1 truncate">{t(item.key)}</span>
                        ) : null}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? t('expand') : t('collapse')}
        className="border-border-base text-text-subtle hover:text-text flex h-11 items-center justify-center gap-2 border-t"
      >
        {collapsed ? (
          <PanelLeftOpen className="size-4" />
        ) : (
          <>
            <PanelLeftClose className="size-4" />
            <span className="text-xs">{t('collapse')}</span>
          </>
        )}
      </button>
    </aside>
  )
}
