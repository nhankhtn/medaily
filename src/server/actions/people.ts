'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { isSupportedBank } from '@/lib/finance/banks'
import { PATHS } from '@/lib/paths'
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

export async function savePerson(input: unknown) {
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

  if (id) await updatePerson(userId, id, values)
  else await insertPerson({ ...values, userId })

  revalidatePeopleAndFinance()
  return { ok: true as const }
}

/**
 * Archived, never deleted: the interactions, photos and debts filed under a
 * person would cascade away with the row, and last year's ledger should not
 * lose a name because the friendship did.
 */
export async function archivePerson(input: unknown) {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const userId = await getCurrentUserId()
  if (!(await findPerson(userId, parsed.data.id))) {
    return { ok: false as const, error: 'not_found' as const }
  }

  await updatePerson(userId, parsed.data.id, { archivedAt: new Date() })
  revalidatePeopleAndFinance()
  return { ok: true as const }
}

export async function restorePerson(input: unknown) {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const userId = await getCurrentUserId()
  if (!(await findPerson(userId, parsed.data.id))) {
    return { ok: false as const, error: 'not_found' as const }
  }

  await updatePerson(userId, parsed.data.id, { archivedAt: null })
  revalidatePeopleAndFinance()
  return { ok: true as const }
}

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

  await insertInteraction({
    userId: await getCurrentUserId(),
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

  await insertReminder({
    userId: await getCurrentUserId(),
    title: parsed.data.title,
    dueOn: parsed.data.dueOn,
    personId: parsed.data.personId ?? null,
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
