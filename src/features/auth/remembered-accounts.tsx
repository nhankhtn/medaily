'use client'

import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useSyncExternalStore } from 'react'
import {
  forget,
  localAccountStore,
  type RememberedAccount,
} from '@/lib/auth/remembered-accounts'

/** Dispatched here when the row changes, so every reader re-reads. */
const CHANGED = 'medaily:accounts-changed'

/** Nothing on the server, and the same array every time so React can compare it. */
const EMPTY: RememberedAccount[] = []

/**
 * `useSyncExternalStore` wants a snapshot that is the same object until the
 * data actually changes; reading and parsing storage afresh would hand it a
 * new array on every render and spin. So the parsed row is held here and
 * thrown away when something writes.
 */
let snapshot: RememberedAccount[] | null = null

function readSnapshot(): RememberedAccount[] {
  snapshot ??= localAccountStore().read()
  return snapshot
}

function subscribe(onChange: () => void): () => void {
  const handle = () => {
    snapshot = null
    onChange()
  }
  window.addEventListener(CHANGED, handle)
  // Another tab on this origin signing in or forgetting an account writes the
  // same key; without this the two windows disagree until one is reloaded.
  window.addEventListener('storage', handle)
  return () => {
    window.removeEventListener(CHANGED, handle)
    window.removeEventListener('storage', handle)
  }
}

/** Writes the row and tells everyone reading it. */
function save(list: RememberedAccount[]): void {
  localAccountStore().write(list)
  snapshot = null
  window.dispatchEvent(new Event(CHANGED))
}

/**
 * The accounts that have signed in on this device, one tap each.
 *
 * This is the shortcut that works everywhere. One Tap — the card Google draws
 * in the corner — is not available on Safari or on any browser on iOS, and an
 * installed home-screen app is exactly where it is furthest out of reach, so
 * on a phone this row is the whole feature rather than a fallback for it.
 */
export function RememberedAccounts({
  pending,
  onPick,
}: {
  pending: boolean
  onPick: (email: string) => void
}) {
  const t = useTranslations('auth')
  // The server has no `localStorage`, so it answers with nothing and the row
  // appears on hydration — which is also what keeps this out of the HTML that
  // a cache or a log might hold on to.
  const accounts = useSyncExternalStore(subscribe, readSnapshot, () => EMPTY)

  if (accounts.length === 0) return null

  return (
    <ul className="space-y-2">
      {accounts.map((account) => (
        <li key={account.email} className="glass-chip flex items-center rounded-full pr-1">
          <button
            type="button"
            disabled={pending}
            onClick={() => onPick(account.email)}
            aria-label={t('continueAs', { email: account.email })}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full py-2 pl-2.5 text-left disabled:opacity-50"
          >
            <Avatar account={account} />
            <span className="min-w-0 flex-1">
              {account.name ? (
                <span className="block truncate text-sm leading-tight font-medium">
                  {account.name}
                </span>
              ) : null}
              <span className="text-text-muted block truncate text-xs leading-tight">
                {account.email}
              </span>
            </span>
          </button>

          {/* Its own button, beside the other one rather than inside it: a
              button within a button is invalid, and browsers resolve it by
              signing the person in when they meant to remove the row. */}
          <button
            type="button"
            disabled={pending}
            onClick={() => save(forget(localAccountStore().read(), account.email))}
            title={t('forgetAccount')}
            aria-label={t('forgetAccount')}
            className="text-text-subtle hover:text-text flex size-8 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
          >
            <X className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * The Google picture, or the initial when there is none.
 *
 * `onError` matters more than it looks: these URLs are Google's and go stale,
 * and the alternative to a fallback is a broken-image glyph next to somebody's
 * address. `no-referrer` because the rest of the app sends none either.
 */
function Avatar({ account }: { account: RememberedAccount }) {
  const [broken, setBroken] = useState(false)
  const initial = (account.name ?? account.email).trim().charAt(0).toUpperCase()

  if (!account.photoUrl || broken) {
    return (
      <span
        aria-hidden
        className="bg-surface-2 text-text-muted flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium"
      >
        {initial}
      </span>
    )
  }

  return (
    <img
      src={account.photoUrl}
      alt=""
      width={28}
      height={28}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className="size-7 shrink-0 rounded-full object-cover"
    />
  )
}
