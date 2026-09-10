'use client'

import { LogOut } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { signOutFirebase } from '@/lib/auth/firebase-client'
import { logout } from '@/server/actions/auth'

export function SignOutButton() {
  const t = useTranslations('auth')

  /**
   * Clear the Firebase session in this browser before dropping our cookie.
   * Our cookie is what governs access, but leaving Firebase signed in means
   * the next "continue with Google" walks straight back in with no chooser.
   */
  const signOut = async () => {
    await signOutFirebase()
    await logout()
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
