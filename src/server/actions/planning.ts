'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { PATHS } from '@/lib/paths'
import { RECURRENCE_RULES } from '@/lib/planning/recurrence'
import { isoDateSchema } from '@/lib/validation/daily'
import {
  deleteEvent,
  deletePlannedBlock,
  insertEvent,
  insertPlannedBlock,
  updateEvent,
  updatePlannedBlock,
} from '@/server/repositories/planning'

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const optionalText = z
  .string()
  .max(2000)
  .transform((value) => (value.trim() === '' ? null : value.trim()))
  .nullable()
  .optional()

function revalidatePlanning() {
  revalidatePath(PATHS.calendar())
  revalidatePath(PATHS.home)
}

/**
 * Create or edit one event.
 *
 * A repeating event is stored as a single row, so editing it moves the whole
 * series — there is nowhere to record "just this Friday", and pretending
 * otherwise would silently drop the change on every other occurrence. The
 * dialog says so before it saves.
 */
export async function saveEvent(input: unknown) {
  const parsed = z
    .object({
      id: z.string().uuid().optional(),
      title: z.string().min(1).max(200),
      date: isoDateSchema,
      startTime: timeSchema.optional(),
      endTime: timeSchema.optional(),
      allDay: z.boolean().default(false),
      location: optionalText,
      note: optionalText,
      recurrenceRule: z.enum(RECURRENCE_RULES).nullable().optional(),
      recurrenceUntil: isoDateSchema.nullable().optional(),
    })
    .refine((value) => !value.recurrenceUntil || value.recurrenceUntil >= value.date, {
      message: 'the series cannot end before it starts',
      path: ['recurrenceUntil'],
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const { id, date, startTime, endTime, allDay, recurrenceRule } = parsed.data
  const startsAt = new Date(`${date}T${allDay ? '00:00' : (startTime ?? '09:00')}:00`)
  const endsAt = allDay ? null : endTime ? new Date(`${date}T${endTime}:00`) : null

  const row = {
    title: parsed.data.title,
    startsAt,
    endsAt,
    allDay,
    location: parsed.data.location ?? null,
    note: parsed.data.note ?? null,
    recurrenceRule: recurrenceRule ?? null,
    // An end date without a rule would be a bound on nothing.
    recurrenceUntil: recurrenceRule ? (parsed.data.recurrenceUntil ?? null) : null,
  }

  const userId = await getCurrentUserId()

  if (id) {
    // A well-formed uuid still has to name a row this user owns.
    const updated = await updateEvent(userId, id, row)
    if (!updated) return { ok: false as const, error: 'not_found' as const }
  } else {
    await insertEvent({ ...row, userId })
  }

  revalidatePlanning()
  return { ok: true as const }
}

export async function removeEvent(input: unknown) {
  const id = z.string().uuid().parse(input)
  await deleteEvent(await getCurrentUserId(), id)
  revalidatePlanning()
  return { ok: true }
}

export async function createPlannedBlock(input: unknown) {
  return savePlannedBlock(input)
}

/** Create or edit one planned block. */
export async function savePlannedBlock(input: unknown) {
  const parsed = z
    .object({
      id: z.string().uuid().optional(),
      blockDate: isoDateSchema,
      startTime: timeSchema,
      endTime: timeSchema,
      kind: z.enum(['learning', 'deep_work', 'project', 'exercise', 'other']),
      projectId: z.string().uuid().nullable().optional(),
      note: optionalText,
    })
    .refine((value) => value.endTime > value.startTime, {
      message: 'end must be after start',
      path: ['endTime'],
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const userId = await getCurrentUserId()
  const row = {
    blockDate: parsed.data.blockDate,
    startTime: parsed.data.startTime,
    endTime: parsed.data.endTime,
    kind: parsed.data.kind,
    projectId: parsed.data.projectId ?? null,
    note: parsed.data.note ?? null,
  }

  if (parsed.data.id) {
    const updated = await updatePlannedBlock(userId, parsed.data.id, row)
    if (!updated) return { ok: false as const, error: 'not_found' as const }
  } else {
    await insertPlannedBlock({ ...row, userId })
  }

  revalidatePlanning()
  return { ok: true as const }
}

export async function removePlannedBlock(input: unknown) {
  const id = z.string().uuid().parse(input)
  await deletePlannedBlock(await getCurrentUserId(), id)
  revalidatePlanning()
  return { ok: true }
}
