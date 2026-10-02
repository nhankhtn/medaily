import './load-env'
import { parseArgs } from 'node:util'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/lib/db/schema'
import { issueGrantToken, readGrantToken } from '@/lib/auth/grant'

/**
 * Mints the one token that lets somebody else file a transaction.
 *
 * Names are resolved here rather than at request time, which is the whole
 * point of minting: a category nobody has, an account spelled two ways, a
 * person who is not in your contacts — all of them fail in front of whoever is
 * running this, instead of at the moment the other person tries to use it.
 *
 *   tsx scripts/grant-token.ts --email me@example.com --person A \
 *     --account "Ví tiền mặt" --category "Ăn sáng" --max 200000 --days 365
 *
 *   tsx scripts/grant-token.ts --inspect <token>
 */
const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    person: { type: 'string' },
    account: { type: 'string' },
    category: { type: 'string' },
    max: { type: 'string' },
    days: { type: 'string', default: '365' },
    inspect: { type: 'string' },
  },
})

/** Case- and space-insensitive, because a name typed twice is rarely identical. */
const same = (a: string, b: string) =>
  a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()

function one<T extends { id: string }>(
  rows: T[],
  named: (row: T) => string,
  wanted: string,
  what: string,
): T {
  const found = rows.filter((row) => same(named(row), wanted))
  if (found.length === 0) {
    const known = rows.map(named).sort().join(', ')
    throw new Error(`no ${what} called "${wanted}". There is: ${known || '(none)'}`)
  }
  // Two with the same name means the token would silently pick one of them.
  if (found.length > 1) throw new Error(`more than one ${what} called "${wanted}"`)
  return found[0]!
}

async function main() {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 16) throw new Error('AUTH_SECRET is required, and at least 16 characters')

  if (values.inspect) {
    const claims = await readGrantToken(values.inspect, secret)
    if (!claims) throw new Error('that token is not readable here: expired, altered, or minted under a different AUTH_SECRET')
    console.log(claims)
    return
  }

  for (const required of ['email', 'person', 'account', 'max'] as const) {
    if (!values[required]) throw new Error(`--${required} is required`)
  }

  const maxAmount = Number(values.max)
  if (!Number.isFinite(maxAmount) || maxAmount <= 0) throw new Error('--max must be a positive number')

  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')

  const client = postgres(url, { max: 1 })
  const db = drizzle(client, { schema })

  try {
    const owners = await db.select().from(schema.users).where(eq(schema.users.email, values.email!))
    const owner = owners[0]
    if (!owner) throw new Error(`no account with the address ${values.email}`)

    const [people, accounts, categories] = await Promise.all([
      db.select().from(schema.people).where(eq(schema.people.userId, owner.id)),
      db.select().from(schema.accounts).where(eq(schema.accounts.userId, owner.id)),
      db.select().from(schema.financeCategories).where(eq(schema.financeCategories.userId, owner.id)),
    ])

    const person = one(people, (row) => row.name, values.person!, 'contact')
    const account = one(accounts, (row) => row.name, values.account!, 'account')
    const category = values.category
      ? one(categories, (row) => row.name, values.category, 'category')
      : null

    const token = await issueGrantToken(
      {
        ownerUserId: owner.id,
        payeePersonId: person.id,
        accountId: account.id,
        categoryId: category?.id ?? null,
        maxAmount,
      },
      secret,
      `${values.days}d`,
    )

    // Printed before the token so whoever is minting reads what it grants
    // rather than only that something was produced.
    console.log('\nThis token lets that person file an expense, and nothing else.\n')
    console.table({
      ledger: `${owner.displayName} <${values.email}>`,
      'paid by': person.name,
      account: account.name,
      'category when none is given': category?.name ?? '(none)',
      'most per transaction': maxAmount.toLocaleString('vi-VN'),
      expires: `${values.days} days`,
    })
    console.log('\nGRANT_TOKEN=' + token + '\n')
    console.log('Set that in the environment and redeploy. Changing it is how you revoke.')
    console.log('Rotating AUTH_SECRET also invalidates it.\n')
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
