import type { GrantClaims } from '@/lib/auth/grant'
import type { ISODate } from '@/lib/dates'
import { log } from '@/lib/log'
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
  | 'too_much'
  | 'unknown_category'
  | 'already_recorded'
  | 'conflict'
  | 'failed'

export type GrantRequest = {
  amount: number
  occurredOn: ISODate
  /** Resolved against this ledger's categories; the grant's default when absent. */
  category?: string | null
  merchant?: string | null
  /** Decided by the caller, so a retry over a bad connection files once. */
  clientId: string
}

export async function fileGrantedTransaction(
  grant: GrantClaims,
  request: GrantRequest,
): Promise<{ ok: true; id: string } | { ok: false; error: GrantFailure }> {
  if (request.amount > grant.maxAmount) return { ok: false, error: 'too_much' }

  const categoryId = await resolveCategory(grant, request.category)
  if (categoryId === undefined) return { ok: false, error: 'unknown_category' }

  /*
   * One meal per day, per category, per payer. A second filing of Wednesday's
   * lunch covered by the same person is that lunch again — whether the owner
   * typed it in the app first or the caller is sending it twice under new ids.
   *
   * `exceptId` keeps a genuine retry working: carrying the same `clientId`
   * would otherwise find its own first attempt and refuse it.
   */
  const standing = await findExpenseOn(
    grant.ownerUserId,
    request.occurredOn,
    categoryId,
    grant.payeePersonId,
    request.clientId,
  )
  if (standing) return { ok: false, error: 'already_recorded' }

  try {
    const saved = await insertTransaction({
      id: request.clientId,
      userId: grant.ownerUserId,
      occurredOn: request.occurredOn,
      amount: String(request.amount),
      kind: 'expense',
      accountId: grant.accountId,
      categoryId,
      payeePersonId: grant.payeePersonId,
      merchant: request.merchant ?? null,
    })

    // `insertTransaction` answers null when that id is already there, which is
    // the retry working as intended rather than a failure.
    if (!saved) return { ok: false, error: 'conflict' }

    await announce(grant, saved.id, request)
    return { ok: true, id: saved.id }
  } catch (error) {
    await log.error('grant', 'could not file a granted transaction', error)
    return { ok: false, error: 'failed' }
  }
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
      url: PATHS.finance,
      tag: `grant:${id}`,
    })
  } catch (error) {
    // The row is saved. Failing the request because the phone could not be
    // told would undo something that already happened.
    await log.error('grant', 'filed, but could not notify', error)
  }
}
