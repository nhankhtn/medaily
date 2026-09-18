'use client'

import { LogOut } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { clearPendingSaves } from '@/features/daily/pending-saves'
import { clearOfflineCaches } from '@/features/daily/register-sw'
import { signOutFirebase } from '@/lib/auth/firebase-client'
import { logout } from '@/server/actions/auth'

/** `card` matches the route tiles in the mobile More sheet. */
export function SignOutButton({ variant = 'icon' }: { variant?: 'icon' | 'card' }) {
  const t = useTranslations('auth')

  /**
   * Clear the Firebase session in this browser before dropping our cookie.
   * Our cookie is what governs access, but leaving Firebase signed in means
   * the next "continue with Google" walks straight back in with no chooser.
   */
  const signOut = async () => {
    await signOutFirebase()
    // Both hold this person's own day: the cache as a rendered page, the
    // queue as a save not yet sent. Neither may be there for whoever signs in
    // next — an unsent day would otherwise be delivered into their account.
    await clearOfflineCaches()
    await clearPendingSaves()
    await logout()
  }

  if (variant === 'card') {
    return (
      <form action={signOut}>
        <button
          type="submit"
          className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-[var(--radius)] border border-border-base bg-surface p-2 text-center"
        >
          <LogOut className="size-6 text-text-subtle" />
          <span className="text-xs leading-tight text-text-muted">{t('signOut')}</span>
        </button>
      </form>
    )
  }

  return (
    <form action={signOut}>
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
