import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { LOCALES } from '@/i18n/config'
import { starterFor } from '@/lib/onboarding/starter'
import {
  findAccountBalances,
  findCategories,
  insertAccounts,
  insertCategories,
} from '@/server/repositories/finance'
import { insertUser } from '@/server/repositories/auth'
import { insertUserSettings } from '@/server/repositories/settings'

/**
 * A stranger's first minute in the app. The rows are written by `provision()`
 * inside its transaction, so what is worth proving here is the part that would
 * actually bite: that the starter lands under the right owner and nobody
 * else's, and that it reads as the language the person signed up in.
 */
const describeDb = process.env.DATABASE_URL ? describe : describe.skip

describeDb('a brand new workspace', () => {
  const created: string[] = []

  const workspace = async (locale: (typeof LOCALES)[number]) => {
    const user = await insertUser({ displayName: `starter-${locale}` })
    created.push(user.id)
    await insertUserSettings(user.id)
    const starter = starterFor(locale)
    await insertCategories(starter.categories.map((category) => ({ userId: user.id, ...category })))
    await insertAccounts(starter.accounts.map((account) => ({ userId: user.id, ...account })))
    return user.id
  }

  afterAll(async () => {
    for (const id of created) await db.delete(schema.users).where(eq(schema.users.id, id))
  })

  it('opens with somewhere to put money and something to call it', async () => {
    const userId = await workspace('vi')

    const categories = await findCategories(userId)
    const accounts = await findAccountBalances(userId)

    expect(categories.length).toBeGreaterThan(0)
    expect(accounts.length).toBeGreaterThan(0)
    // Recording either direction has to be possible on day one.
    expect(categories.some((row) => row.kind === 'income')).toBe(true)
    expect(categories.some((row) => row.kind === 'expense')).toBe(true)
  })

  it('writes them in the language the person signed up in', async () => {
    const vi = await workspace('vi')
    const en = await workspace('en')

    expect((await findCategories(vi)).map((row) => row.name)).toContain('Ăn uống')
    expect((await findCategories(en)).map((row) => row.name)).toContain('Food')
  })

  /** The whole point of provisioning: a workspace of one's own. */
  it('gives them to the new user and nobody else', async () => {
    const mine = await workspace('en')
    const theirs = await workspace('en')

    const ids = (await findCategories(mine)).map((row) => row.id)
    const others = (await findCategories(theirs)).map((row) => row.id)
    expect(ids.some((id) => others.includes(id))).toBe(false)
  })

  it('offers every locale a starter, so a new language cannot ship empty', () => {
    for (const locale of LOCALES) {
      const starter = starterFor(locale)
      expect(starter.categories.length).toBeGreaterThan(0)
      expect(starter.accounts.length).toBeGreaterThan(0)
    }
  })
})
