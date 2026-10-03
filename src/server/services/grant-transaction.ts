import { sql } from 'drizzle-orm'
import type { GrantClaims } from '@/lib/auth/grant'
import { db } from '@/lib/db'
import type { ISODate } from '@/lib/dates'
import { log } from '@/lib/log'
import { transferReference } from '@/lib/finance/vietqr'
import { PATHS } from '@/lib/paths'
import { findCategories, findExpenseOn, insertTransaction } from '@/server/repositories/finance'
import { findPerson } from '@/server/repositories/people'
import { notify } from './push'

/**
 * Filing a transaction on somebody else's behalf.
 *
 * It is an expense with `payeePersonId` set and `transferredAt` left null —
 * not `personId`. That one is a debt and is deliberately excluded from
 * spending totals, so using it would make the money vanish from the month's
 * report. This is the other case: the expense happened, and whoever covered it
 * is still owed.
 */
export type GrantFailure =
  | 'invalid_amount'
  | 'too_much'
  | 'unknown_category'
  | 'already_recorded'
  | 'failed'

export type GrantRequest = {
  amount: number
  occurredOn: ISODate
  /** The ledger's own currency. The caller does not choose it. */
  currency: string
  /** Resolved against this ledger's categories; the grant's default when absent. */
  category?: string | null
  merchant?: string | null
}

/**
 * A ledger amount: at most two decimal places, and still above zero once
 * those places are kept. `0.004` would round to `0.00` and then fail the
 * database check as a 500.
 */
export function isLedgerAmount(amount: number): boolean {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) return false
  const cents = Math.round(amount * 100)
  return cents >= 1 && Math.abs(amount * 100 - cents) < 1e-6
}

export async function fileGrantedTransaction(
  grant: GrantClaims,
  request: GrantRequest,
): Promise<{ ok: true; id: string } | { ok: false; error: GrantFailure }> {
  if (!isLedgerAmount(request.amount)) return { ok: false, error: 'invalid_amount' }
  if (request.amount > grant.maxAmount) return { ok: false, error: 'too_much' }

  const categoryId = await resolveCategory(grant, request.category)
  if (categoryId === undefined) return { ok: false, error: 'unknown_category' }

  try {
    const saved = await db.transaction(async (tx) => {
      // One meal at a time. Two requests for the same day, category and payer
      // would otherwise both see an empty ledger and both write. Not a unique
      // index: the owner may still record two coffees themselves.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${mealKey(grant, request.occurredOn, categoryId)}, 0::bigint))`,
      )

      const standing = await findExpenseOn(
        grant.ownerUserId,
        request.occurredOn,
        categoryId,
        grant.payeePersonId,
        tx,
      )
      if (standing) return { status: 'duplicate' as const }

      const row = await insertTransaction(
        {
          userId: grant.ownerUserId,
          occurredOn: request.occurredOn,
          amount: (Math.round(request.amount * 100) / 100).toFixed(2),
          currency: request.currency,
          kind: 'expense',
          accountId: grant.accountId,
          categoryId,
          payeePersonId: grant.payeePersonId,
          merchant: request.merchant ?? null,
        },
        tx,
      )
      return row ? { status: 'saved' as const, row } : { status: 'failed' as const }
    })

    if (saved.status === 'duplicate') return { ok: false, error: 'already_recorded' }
    if (saved.status === 'failed') return { ok: false, error: 'failed' }

    await announce(grant, saved.row.id, request)
    return { ok: true, id: saved.row.id }
  } catch (error) {
    await log.error('grant', 'could not file a granted transaction', error)
    return { ok: false, error: 'failed' }
  }
}

/** What the lock is held on: one meal, and nothing else waits. */
function mealKey(grant: GrantClaims, occurredOn: ISODate, categoryId: string | null): string {
  return `grant:${grant.ownerUserId}:${occurredOn}:${categoryId ?? ''}:${grant.payeePersonId}`
}

/**
 * `undefined` means the caller named a category this ledger does not have.
 *
 * Refused rather than created: an endpoint that invents categories fills the
 * ledger with near-duplicates nobody chose, and the owner is not there to
 * notice.
 */
async function resolveCategory(
  grant: GrantClaims,
  named: string | null | undefined,
): Promise<string | null | undefined> {
  if (!named?.trim()) return grant.categoryId

  const wanted = named.trim().toLocaleLowerCase()
  const categories = await findCategories(grant.ownerUserId)
  const found = categories.filter((row) => row.name.trim().toLocaleLowerCase() === wanted)
  return found.length === 1 ? found[0]!.id : undefined
}

/** Somebody else just wrote in your ledger; you should hear about it. */
async function announce(
  grant: GrantClaims,
  id: string,
  request: GrantRequest,
): Promise<void> {
  try {
    const person = await findPerson(grant.ownerUserId, grant.payeePersonId)
    const who = person?.name ?? 'Ai đó'
    await notify([grant.ownerUserId], {
      title: `${who} vừa ghi một khoản chi`,
      body: `${request.amount.toLocaleString('vi-VN')}₫${request.merchant ? ` · ${request.merchant}` : ''}`,
      // Straight to the row, not just the ledger: the notification is about
      // one expense, and arriving at a month of them is arriving nowhere.
      url: PATHS.financeSearch(transferReference(id)),
      tag: `grant:${id}`,
    })
  } catch (error) {
    // The row is saved. Failing the request because the phone could not be
    // told would undo something that already happened.
    await log.error('grant', 'filed, but could not notify', error)
  }
}
