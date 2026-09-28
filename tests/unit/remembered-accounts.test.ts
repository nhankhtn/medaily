import { describe, expect, it } from 'vitest'
import {
  forget,
  MAX_REMEMBERED,
  memoryAccountStore,
  parseAccounts,
  remember,
  type RememberedAccount,
} from '@/lib/auth/remembered-accounts'

/**
 * The row of accounts offered on the sign-in page. It survives sign-out by
 * design, so the rules that keep it correct are the rules that keep one
 * person's address from being offered in another person's place.
 */
const account = (email: string, lastUsedAt: number): RememberedAccount => ({
  email,
  name: null,
  photoUrl: null,
  lastUsedAt,
})

describe('remember', () => {
  it('keeps one entry per address, the newest', () => {
    const list = remember(
      remember([], { ...account('a@x.com', 1), name: 'Old' }),
      { ...account('a@x.com', 2), name: 'New' },
    )

    expect(list).toHaveLength(1)
    expect(list[0]?.name).toBe('New')
  })

  /**
   * Google addresses are case-insensitive, so the same person typing their
   * address differently must not end up with two chips for one account.
   */
  it('treats a different casing as the same address', () => {
    const list = remember(remember([], account('A@X.com', 1)), account('a@x.com', 2))
    expect(list).toHaveLength(1)
  })

  it('puts the most recently used first', () => {
    const list = remember(remember([], account('old@x.com', 10)), account('new@x.com', 20))
    expect(list.map((entry) => entry.email)).toEqual(['new@x.com', 'old@x.com'])
  })

  /**
   * Two sign-ins inside one millisecond would otherwise leave the order to
   * sort stability, and chips that swap places between loads for no visible
   * reason are a bug nobody can reproduce.
   */
  it('breaks a tie on the address, so the order never wobbles', () => {
    const one = remember(remember([], account('b@x.com', 5)), account('a@x.com', 5))
    const other = remember(remember([], account('a@x.com', 5)), account('b@x.com', 5))
    expect(one.map((e) => e.email)).toEqual(other.map((e) => e.email))
  })

  it('caps the row by dropping the least recently used', () => {
    let list: RememberedAccount[] = []
    for (let i = 0; i < MAX_REMEMBERED + 3; i++) list = remember(list, account(`u${i}@x.com`, i))

    expect(list).toHaveLength(MAX_REMEMBERED)
    expect(list.map((e) => e.email)).not.toContain('u0@x.com')
  })

  it('ignores an entry with no address, rather than storing a blank chip', () => {
    expect(remember([], account('   ', 1))).toEqual([])
  })
})

describe('forget', () => {
  it('drops the address it is given and nothing else', () => {
    const list = remember(remember([], account('a@x.com', 1)), account('b@x.com', 2))
    expect(forget(list, 'a@x.com').map((e) => e.email)).toEqual(['b@x.com'])
  })

  it('matches regardless of casing, or the × would appear to do nothing', () => {
    const list = remember([], account('a@x.com', 1))
    expect(forget(list, 'A@X.COM')).toEqual([])
  })
})

describe('parseAccounts', () => {
  /**
   * What comes back is whatever is under that key now — an older version of
   * this app, another script on the origin, or someone editing by hand. A
   * sign-in page that throws because of it is worse than no shortcut.
   */
  it('survives anything that is not a list of accounts', () => {
    expect(parseAccounts(null)).toEqual([])
    expect(parseAccounts('nonsense')).toEqual([])
    expect(parseAccounts([1, 'two', null])).toEqual([])
    expect(parseAccounts([{ name: 'no address' }])).toEqual([])
  })

  it('fills in what an older entry does not carry', () => {
    const [entry] = parseAccounts([{ email: 'a@x.com' }])
    expect(entry).toEqual({ email: 'a@x.com', name: null, photoUrl: null, lastUsedAt: 0 })
  })

  it('re-applies the cap and the one-per-address rule to stored data', () => {
    const stored = Array.from({ length: MAX_REMEMBERED + 4 }, (_, i) => ({
      email: `u${i}@x.com`,
      lastUsedAt: i,
    }))
    expect(parseAccounts([...stored, { email: 'U0@X.com', lastUsedAt: 99 }])).toHaveLength(
      MAX_REMEMBERED,
    )
  })
})

describe('memoryAccountStore', () => {
  it('reads back what was written', () => {
    const store = memoryAccountStore()
    store.write(remember(store.read(), account('a@x.com', 1)))
    expect(store.read().map((e) => e.email)).toEqual(['a@x.com'])
  })
})
