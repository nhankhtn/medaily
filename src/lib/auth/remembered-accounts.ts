/**
 * Accounts that have signed in on this device, so coming back is one tap.
 *
 * Outlives sign-out on purpose — that is the moment it is worth anything,
 * unlike the drafts and queues cleared then. No token is kept and nothing here
 * grants access, but a shared device still shows the last address, so every
 * entry is removable in one tap.
 */

export type RememberedAccount = {
  email: string
  name: string | null
  photoUrl: string | null
  /** Epoch millis of the last successful sign-in with this account. */
  lastUsedAt: number
}

/** Past this the row stops being a shortcut and becomes a list to read. */
export const MAX_REMEMBERED = 4

/** Addresses are case-insensitive for the purpose of "is this the same one". */
function keyOf(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Newest first, one per address, capped. The email tiebreaker stops two
 * sign-ins in the same millisecond reordering between loads.
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
 * Storage survives app versions and is shared with every script on the origin,
 * so this is untrusted input. An entry with no address is dropped.
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
      lastUsedAt:
        typeof row.lastUsedAt === 'number' && Number.isFinite(row.lastUsedAt) ? row.lastUsedAt : 0,
    })
  }

  // Re-applies the shape rules to a list written by an older version.
  return parsed.reduce<RememberedAccount[]>((list, entry) => remember(list, entry), [])
}

/** Where the row of chips is read from and written to. */
export interface AccountStore {
  read(): RememberedAccount[]
  write(list: RememberedAccount[]): void
}

export const ACCOUNTS_KEY = 'medaily.accounts.v1'

/** Guarded throughout: `localStorage` throws where site data is blocked. */
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
