'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { audited, type NoteChange } from '@/server/services/audited'
import { personSnapshot } from '@/server/services/activity-snapshots'
import { isSupportedBank } from '@/lib/finance/banks'
import { PATHS } from '@/lib/paths'
import { ownedOrNull } from '@/server/services/ownership'
import { isoDateSchema } from '@/lib/validation/daily'
import {
  completeReminder,
  findPerson,
  insertInteraction,
  insertPerson,
  insertReminder,
  updatePerson,
} from '@/server/repositories/people'

const optionalText = z
  .string()
  .max(2000)
  .transform((value) => (value.trim() === '' ? null : value.trim()))
  .nullable()
  .optional()

/** Napas codes are exactly six digits; anything else would build a QR that scans wrong. */
const bankBinSchema = z
  .string()
  .max(20)
  .transform((value) => value.replace(/\D/g, ''))
  .refine((value) => value === '' || isSupportedBank(value), { message: 'unknown bank' })
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional()

const accountNumberSchema = z
  .string()
  .max(40)
  .transform((value) => value.replace(/[^a-zA-Z0-9]/g, ''))
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional()

function revalidatePeople() {
  revalidatePath(PATHS.people)
  revalidatePath(PATHS.home)
}

/** Archiving also moves who the payee picker and the debt list can name. */
function revalidatePeopleAndFinance() {
  revalidatePeople()
  revalidatePath(PATHS.finance)
}

export const savePerson = audited(
  (_result, input: unknown) => ((input as { id?: string }).id ? 'person.update' : 'person.create'),
  async (input: unknown, audit: NoteChange) => {
    const parsed = z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(200),
        relationship: z
          .enum(['partner', 'family', 'friend', 'colleague', 'mentor', 'other'])
          .default('friend'),
        company: optionalText,
        role: optionalText,
        birthday: isoDateSchema.nullable().optional(),
        phone: optionalText,
        email: optionalText,
        notes: optionalText,
        contactIntervalDays: z.number().int().min(1).max(3650).nullable().optional(),
        bankBin: bankBinSchema,
        bankAccountNumber: accountNumberSchema,
        bankAccountName: optionalText,
        momoPhone: optionalText,
        paymentQr: optionalText,
      })
      .safeParse(input)
    if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

    const userId = await getCurrentUserId()
    const { id, ...values } = parsed.data

    // Only on an edit: a create has nothing standing there to read.
    const before = id ? await findPerson(userId, id) : null
    if (id) await updatePerson(userId, id, values)
    else await insertPerson({ ...values, userId })

    audit({ current: personSnapshot(before), request: personSnapshot(values) })

    revalidatePeopleAndFinance()
    return { ok: true as const }
  },
  ({ input }) => ({
    entityId: (input as { id?: string }).id ?? null,
    label: (input as { name?: string }).name ?? null,
  }),
)

/**
 * Archived, never deleted: the interactions, photos and debts filed under a
 * person would cascade away with the row, and last year's ledger should not
 * lose a name because the friendship did.
 */
export const archivePerson = audited(
  'person.delete',
  async (input: unknown, audit: NoteChange) => {
    const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
    if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

    const userId = await getCurrentUserId()
    const found = await findPerson(userId, parsed.data.id)
    if (!found) return { ok: false as const, error: 'not_found' as const }

    await updatePerson(userId, parsed.data.id, { archivedAt: new Date() })
    // The row the guard above already read — no second query to say who went.
    audit({ current: personSnapshot(found) })
    revalidatePeopleAndFinance()
    return { ok: true as const }
  },
  ({ input }) => ({ entityId: (input as { id?: string }).id ?? null }),
)

export const restorePerson = audited(
  'person.restore',
  async (input: unknown, audit: NoteChange) => {
    const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
    if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

    const userId = await getCurrentUserId()
    const found = await findPerson(userId, parsed.data.id)
    if (!found) return { ok: false as const, error: 'not_found' as const }

    await updatePerson(userId, parsed.data.id, { archivedAt: null })
    audit({ request: personSnapshot(found) })
    revalidatePeopleAndFinance()
    return { ok: true as const }
  },
  ({ input }) => ({ entityId: (input as { id?: string }).id ?? null }),
)

export async function logInteraction(input: unknown) {
  const parsed = z
    .object({
      personId: z.string().uuid(),
      occurredOn: isoDateSchema,
      channel: z.enum(['in_person', 'call', 'message', 'email', 'other']).default('message'),
      summary: optionalText,
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const userId = await getCurrentUserId()
  if (!(await findPerson(userId, parsed.data.personId))) {
    return { ok: false as const, error: 'not_found' as const }
  }

  await insertInteraction({
    userId,
    personId: parsed.data.personId,
    occurredOn: parsed.data.occurredOn,
    channel: parsed.data.channel,
    summary: parsed.data.summary ?? null,
  })

  revalidatePeople()
  return { ok: true as const }
}

export async function createReminder(input: unknown) {
  const parsed = z
    .object({
      title: z.string().min(1).max(200),
      dueOn: isoDateSchema,
      personId: z.string().uuid().nullable().optional(),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const userId = await getCurrentUserId()
  await insertReminder({
    userId,
    title: parsed.data.title,
    dueOn: parsed.data.dueOn,
    personId: await ownedOrNull(userId, parsed.data.personId ?? null, findPerson),
  })

  revalidatePeople()
  return { ok: true as const }
}

export async function markReminderDone(input: unknown) {
  const id = z.string().uuid().parse(input)
  await completeReminder(await getCurrentUserId(), id)
  revalidatePeople()
  return { ok: true }
}
