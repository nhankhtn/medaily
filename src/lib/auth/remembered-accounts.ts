/**
 * The Google accounts that have signed in on this device, so coming back is
 * one tap instead of Google's account chooser.
 *
 * It outlives sign-out on purpose. The moment a remembered account is worth
 * anything is the moment right after somebody signs out — clearing it then
 * would leave the feature with no occasion to exist. That is the opposite of
 * the daily drafts and the offline queues, which *are* cleared then, and the
 * difference is what each one holds: those hold what a person wrote, this
 * holds only which door they came in by. On a shared device it still shows the
 * previous person's address, which is why every entry is removable in one tap.
 *
 * No token is kept here, and nothing here grants access. Tapping an entry only
 * pre-fills the account for Google, which still asks Google's own questions.
 *
 * The rules are pure and the browser sits behind `AccountStore`, so the parts
 * worth getting right are testable without one.
 */

export type RememberedAccount = {
  email: string
  name: string | null
  photoUrl: string | null
  /** Epoch millis of the last successful sign-in with this account. */
  lastUsedAt: number
}

/**
 * Enough for a phone that two people share and a laptop with a work address.
 * Past that the row stops being a shortcut and starts being a list to read.
 */
export const MAX_REMEMBERED = 4

/** Addresses are case-insensitive for the purpose of "is this the same one". */
function keyOf(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Newest first, one entry per address, capped.
 *
 * The tiebreaker on email is not decoration: two sign-ins inside the same
 * millisecond would otherwise leave the order to sort stability, and a row of
 * chips that swaps places between two loads for no visible reason is the kind
 * of bug nobody can reproduce.
 */
export function remember(
  list: RememberedAccount[],
  account: RememberedAccount,
): RememberedAccount[] {
  const key = keyOf(account.email)
  if (key.length === 0) return list

  return [account, ...list.filter((entry) => keyOf(entry.email) !== key)]
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt || (a.email < b.email ? -1 : 1))
    .slice(0, MAX_REMEMBERED)
}

/** Drops one address. The × on each chip, and the only way back out. */
export function forget(list: RememberedAccount[], email: string): RememberedAccount[] {
  const key = keyOf(email)
  return list.filter((entry) => keyOf(entry.email) !== key)
}

/**
 * Whatever came out of storage, narrowed to entries this app can render.
 *
 * Storage is shared with every other script on the origin and survives across
 * versions of this app, so what comes back is untrusted input rather than the
 * value that was written. An entry without an address cannot be signed in with
 * and is dropped rather than shown as a blank chip.
 */
export function parseAccounts(value: unknown): RememberedAccount[] {
  if (!Array.isArray(value)) return []

  const parsed: RememberedAccount[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue
    const row = entry as Record<string, unknown>
    if (typeof row.email !== 'string' || keyOf(row.email).length === 0) continue

    parsed.push({
      email: row.email,
      name: typeof row.name === 'string' ? row.name : null,
      photoUrl: typeof row.photoUrl === 'string' ? row.photoUrl : null,
      lastUsedAt: typeof row.lastUsedAt === 'number' && Number.isFinite(row.lastUsedAt)
        ? row.lastUsedAt
        : 0,
    })
  }

  // Re-applies the shape rules to a list written by an older version, or by
  // hand: one per address, newest first, capped.
  return parsed.reduce<RememberedAccount[]>(
    (list, entry) => remember(list, entry),
    [],
  )
}

/** Where the row of chips is read from and written to. */
export interface AccountStore {
  read(): RememberedAccount[]
  write(list: RememberedAccount[]): void
}

export const ACCOUNTS_KEY = 'medaily.accounts.v1'

/**
 * The real store.
 *
 * Every access is guarded: `localStorage` throws rather than returns null in a
 * private window and where site data is blocked, and a sign-in page that
 * cannot render because remembering failed would be a poor trade for a
 * shortcut.
 */
export function localAccountStore(): AccountStore {
  return {
    read() {
      try {
        const raw = localStorage.getItem(ACCOUNTS_KEY)
        return raw === null ? [] : parseAccounts(JSON.parse(raw))
      } catch {
        return []
      }
    },

    write(list) {
      try {
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list))
      } catch {
        /* out of quota, or storage refused. The shortcut is not worth a throw. */
      }
    },
  }
}

/** For tests and for anywhere `localStorage` is not the right home. */
export function memoryAccountStore(initial: RememberedAccount[] = []): AccountStore {
  let list = parseAccounts(initial)
  return {
    read: () => list,
    write: (next) => {
      list = next
    },
  }
}
