import type { Snapshot } from '@/lib/activity/types'

/**
 * How a row is written down for the trail.
 *
 * Two rules decide what goes in, and both are about being readable in a year
 * rather than about being complete:
 *
 * - **Names, not ids.** `categoryId: 3f2a…` is the thing the history dialog
 *   exists to replace, and resolving it when the trail is read stops working
 *   the day that category is deleted. The name is copied in.
 * - **A whitelist.** A field that is not listed here is a field the trail does
 *   not follow. The body of a journal entry, the text of a note and the whole
 *   of the daily log are absent on purpose: a log that quotes what it watched
 *   is a second copy of the thing it was meant to be a record *about*.
 *
 * Enum tokens (`expense`, `savings`, `partner`) are stored raw and translated
 * when read. Unlike a category, an enum is the app's own vocabulary — it does
 * not get deleted out from under the trail, and keeping the token means the
 * dialog reads in whichever language is on now rather than the one that was on
 * when the row was written.
 */
export type NameOf = (id: string | null | undefined) => string | null

/** Only the fields a snapshot reads, so a DB row and a parsed form both fit. */
type TransactionLike = {
  occurredOn?: string | Date | null
  amount?: string | number | null
  currency?: string | null
  kind?: string | null
  accountId?: string | null
  counterAccountId?: string | null
  categoryId?: string | null
  personId?: string | null
  merchant?: string | null
}

export function transactionSnapshot(
  row: TransactionLike | null | undefined,
  names: { account: NameOf; category: NameOf; person: NameOf },
): Snapshot | null {
  if (!row) return null
  return compact({
    occurredOn: day(row.occurredOn),
    amount: money(row.amount, row.currency),
    kind: text(row.kind),
    account: names.account(row.accountId),
    counterAccount: names.account(row.counterAccountId),
    category: names.category(row.categoryId),
    person: names.person(row.personId),
    merchant: text(row.merchant),
  })
}

type AccountLike = {
  name?: string | null
  type?: string | null
  currency?: string | null
  openingBalance?: string | number | null
  archivedAt?: Date | string | null
}

export function accountSnapshot(row: AccountLike | null | undefined): Snapshot | null {
  if (!row) return null
  return compact({
    name: text(row.name),
    type: text(row.type),
    currency: text(row.currency),
    openingBalance: money(row.openingBalance, row.currency),
  })
}

type CategoryLike = { name?: string | null; kind?: string | null; note?: string | null }

export function categorySnapshot(row: CategoryLike | null | undefined): Snapshot | null {
  if (!row) return null
  return compact({ name: text(row.name), kind: text(row.kind), note: text(row.note) })
}

type HabitLike = {
  name?: string | null
  frequencyType?: string | null
  intervalDays?: number | null
  target?: number | string | null
  linkedMetric?: string | null
  startDate?: string | Date | null
}

export function habitSnapshot(row: HabitLike | null | undefined): Snapshot | null {
  if (!row) return null
  return compact({
    name: text(row.name),
    frequency: text(row.frequencyType),
    intervalDays: number(row.intervalDays),
    target: number(row.target),
    linkedMetric: text(row.linkedMetric),
    startDate: day(row.startDate),
  })
}

type GoalLike = {
  name?: string | null
  status?: string | null
  targetDate?: string | Date | null
  progressMode?: string | null
  metricTarget?: number | string | null
}

export function goalSnapshot(row: GoalLike | null | undefined): Snapshot | null {
  if (!row) return null
  return compact({
    name: text(row.name),
    status: text(row.status),
    targetDate: day(row.targetDate),
    progressMode: text(row.progressMode),
    metricTarget: number(row.metricTarget),
  })
}

type PersonLike = {
  name?: string | null
  relationship?: string | null
  company?: string | null
  role?: string | null
  birthday?: string | Date | null
  phone?: string | null
  email?: string | null
  contactIntervalDays?: number | null
  bankAccountNumber?: string | null
}

export function personSnapshot(row: PersonLike | null | undefined): Snapshot | null {
  if (!row) return null
  return compact({
    name: text(row.name),
    relationship: text(row.relationship),
    company: text(row.company),
    role: text(row.role),
    birthday: day(row.birthday),
    phone: text(row.phone),
    email: text(row.email),
    contactIntervalDays: number(row.contactIntervalDays),
    // Enough to see that it changed, not enough to be a second copy of it.
    bankAccountNumber: masked(row.bankAccountNumber),
  })
}

type NoteLike = { title?: string | null; type?: string | null; learnedOn?: string | Date | null }

/** `bodyMd` is missing on purpose — see the whitelist rule at the top. */
export function noteSnapshot(row: NoteLike | null | undefined): Snapshot | null {
  if (!row) return null
  return compact({
    title: text(row.title),
    type: text(row.type),
    learnedOn: day(row.learnedOn),
  })
}

/** A lookup that answers `null` for anything, for an action with no lists to hand. */
export const noNames: { account: NameOf; category: NameOf; person: NameOf } = {
  account: () => null,
  category: () => null,
  person: () => null,
}

/** Builds the three lookups a transaction needs out of rows already loaded. */
export function namesFrom(lists: {
  accounts?: { id: string; name: string }[]
  categories?: { id: string; name: string }[]
  people?: { id: string; name: string }[]
}) {
  return {
    account: lookup(lists.accounts),
    category: lookup(lists.categories),
    person: lookup(lists.people),
  }
}

function lookup(rows: { id: string; name: string }[] | undefined): NameOf {
  const byId = new Map((rows ?? []).map((row) => [row.id, row.name]))
  return (id) => (id ? (byId.get(id) ?? null) : null)
}

/** A snapshot carries only what it knows; an absent field is not a cleared one. */
function compact(fields: Snapshot): Snapshot | null {
  const out: Snapshot = {}
  for (const [field, value] of Object.entries(fields)) if (value !== null) out[field] = value
  return Object.keys(out).length > 0 ? out : null
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function number(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? String(parsed) : null
}

/**
 * Grouped, with the currency spelled out. Written with a fixed grouping rather
 * than the reader's locale because it is stored: the row records what the
 * amount was, and it must not appear to change when the language does.
 */
const GROUPED = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })

function money(value: unknown, currency: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return `${GROUPED.format(parsed)} ${currency?.trim() || 'VND'}`
}

/** `27/09/2026` — the same way round the rest of the app writes a date. */
function day(value: unknown): string | null {
  if (!value) return null
  const at = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(at.getTime())) return text(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(at.getDate())}/${pad(at.getMonth() + 1)}/${at.getFullYear()}`
}

/** Last four digits only: enough to tell two accounts apart, useless on its own. */
function masked(value: unknown): string | null {
  const digits = text(value)?.replace(/\D/g, '')
  if (!digits) return null
  return digits.length <= 4 ? '••••' : `••••${digits.slice(-4)}`
}
