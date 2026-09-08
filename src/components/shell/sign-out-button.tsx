'use client'

import { LogOut } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { logout } from '@/server/actions/auth'

export function SignOutButton() {
  const t = useTranslations('auth')

  return (
    <form action={logout}>
      <button
        type="submit"
        title={t('signOut')}
        aria-label={t('signOut')}
        className="flex size-9 items-center justify-center rounded-full text-text-subtle hover:bg-surface-2 hover:text-text"
      >
        <LogOut className="size-4" />
      </button>
    </form>
  )
}
