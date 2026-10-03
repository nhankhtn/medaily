import './load-env'
import { and, asc, isNotNull, isNull } from 'drizzle-orm'
import { db, sql } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { claimUsername } from '@/server/services/auth'

/**
 * Gives every account that still has no username the handle in its address.
 *
 * Opening settings used to do this for whoever happened to visit. Run this
 * once instead, oldest account first, so the first person keeps the bare name
 * and the next ones take a short suffix.
 *
 *   pnpm db:fill-usernames
 *   MEDAILY_ENV=prod pnpm db:fill-usernames
 */
const pending = await db
  .select({ id: users.id, email: users.email })
  .from(users)
  .where(and(isNull(users.username), isNotNull(users.email)))
  .orderBy(asc(users.createdAt), asc(users.id))

let filled = 0
let skipped = 0
for (const user of pending) {
  const handle = await claimUsername(user.id, user.email)
  if (handle) {
    filled += 1
    console.log(`${user.id} → ${handle}`)
  } else {
    skipped += 1
    console.log(`${user.id} skipped`)
  }
}

console.log(`filled ${filled}, skipped ${skipped}, of ${pending.length}`)
await sql.end()
