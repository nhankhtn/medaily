'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { isoDateSchema } from '@/lib/validation/daily'
import {
  completeReminder,
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

function revalidatePeople() {
  revalidatePath('/people')
  revalidatePath('/')
}

export async function savePerson(input: unknown) {
  const parsed = z
    .object({
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(200),
      relationship: z.enum(['family', 'friend', 'colleague', 'mentor', 'other']).default('friend'),
      company: optionalText,
      role: optionalText,
      birthday: isoDateSchema.nullable().optional(),
      phone: optionalText,
      email: optionalText,
      notes: optionalText,
      contactIntervalDays: z.number().int().min(1).max(3650).nullable().optional(),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const userId = getCurrentUserId()
  const { id, ...values } = parsed.data

  if (id) await updatePerson(userId, id, values)
  else await insertPerson({ ...values, userId })

  revalidatePeople()
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
    userId: getCurrentUserId(),
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
    userId: getCurrentUserId(),
    title: parsed.data.title,
    dueOn: parsed.data.dueOn,
    personId: parsed.data.personId ?? null,
  })

  revalidatePeople()
  return { ok: true as const }
}

export async function markReminderDone(input: unknown) {
  const id = z.string().uuid().parse(input)
  await completeReminder(getCurrentUserId(), id)
  revalidatePeople()
  return { ok: true }
}
