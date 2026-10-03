import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readConfiguredGrant } from '@/lib/auth/grant'
import { clientKey } from '@/lib/client-ip'
import { addDays, today } from '@/lib/dates'
import { isoDateSchema } from '@/lib/validation/daily'
import { createLimit } from '@/lib/rate-limit'
import {
  fileGrantedTransaction,
  isGrantDay,
  isLedgerAmount,
} from '@/server/services/grant-transaction'
import { dayContextOf, settingsOf } from '@/server/services/settings'

/**
 * The one thing somebody outside this account may do: file an expense they
 * covered.
 *
 * Public to `proxy.ts` because it carries its own credential — the session
 * cookie is a browser's, and this is called with curl. Everything that decides
 * *what* may be written is sealed in the token, so the body names an amount
 * and nothing that could point at another ledger.
 */
export const runtime = 'nodejs'

/** Generous: one person filing what they bought, not a sync. */
const filings = createLimit({ capacity: 30, refillMs: 60 * 60 * 1000 })

export const grantTransactionBody = z.object({
  amount: z.number().refine(isLedgerAmount, 'a positive number with at most two decimal places'),
  occurredOn: isoDateSchema.optional(),
  category: z.string().trim().max(120, 'at most 120 characters').optional(),
  merchant: z.string().trim().max(200, 'at most 200 characters').optional(),
})

const nostore = { 'cache-control': 'no-store' } as const

function fail(error: string, status: number, detail?: { field: string; expected: string }) {
  return NextResponse.json({ ok: false, error, ...detail }, { status, headers: nostore })
}

/** The first field that failed, and the shape it should have had. */
export function inputProblem(error: z.ZodError): { field: string; expected: string } {
  const issue = error.issues[0]
  const field = issue?.path.find((part) => typeof part === 'string')
  if (!issue || typeof field !== 'string') return { field: 'body', expected: 'a JSON object' }
  return { field, expected: issue.message }
}

export async function POST(request: Request) {
  const header = request.headers.get('authorization') ?? ''
  const presented = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!presented) return fail('unauthorized', 401)

  // Keyed by caller, not by token: a wrong token must not be able to spend the
  // real one's allowance.
  if (!filings.take(clientKey(request.headers)).allowed) return fail('rate_limited', 429)

  const grant = await readConfiguredGrant(presented)
  // One answer for "no grant configured", "wrong token" and "expired", so the
  // endpoint cannot be used to find out which.
  if (!grant) return fail('unauthorized', 401)

  const parsed = grantTransactionBody.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail('invalid_input', 400, inputProblem(parsed.error))

  // The owner's own day, not the server's: a purchase at 1am belongs to the
  // night before if that is how they have set the rollover.
  const settings = await settingsOf(grant.ownerUserId)
  const logicalToday = today(dayContextOf(settings))
  const occurredOn = parsed.data.occurredOn ?? logicalToday
  // Three days, and none of them in the future. Older than that is a backfill,
  // which this endpoint is not for.
  if (!isGrantDay(occurredOn, logicalToday)) {
    return fail('date_out_of_range', 422, {
      field: 'occurredOn',
      expected: `yyyy-MM-dd from ${addDays(logicalToday, -2)} to ${logicalToday}`,
    })
  }

  const result = await fileGrantedTransaction(grant, {
    ...parsed.data,
    occurredOn,
    currency: settings.defaultCurrency,
  })

  if (!result.ok) {
    if (result.error === 'invalid_amount') return fail('invalid_input', 400)
    if (result.error === 'too_much') return fail('too_much', 403)
    if (result.error === 'unknown_category') return fail('unknown_category', 422)
    // That day, that category, that payer already has one. 409 rather than
    // 422: nothing about the request is malformed, the ledger simply already
    // says this.
    if (result.error === 'already_recorded') return fail('already_recorded', 409)
    return fail('failed', 500)
  }

  return NextResponse.json({ ok: true, id: result.id }, { headers: nostore })
}
