'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { isoDateSchema } from '@/lib/validation/daily'
import {
  deleteEvent,
  deletePlannedBlock,
  insertEvent,
  insertPlannedBlock,
} from '@/server/repositories/planning'

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const optionalText = z
  .string()
  .max(2000)
  .transform((value) => (value.trim() === '' ? null : value.trim()))
  .nullable()
  .optional()

function revalidatePlanning() {
  revalidatePath('/calendar')
  revalidatePath('/')
}

export async function createEvent(input: unknown) {
  const parsed = z
    .object({
      title: z.string().min(1).max(200),
      date: isoDateSchema,
      startTime: timeSchema.optional(),
      endTime: timeSchema.optional(),
      allDay: z.boolean().default(false),
      location: optionalText,
      note: optionalText,
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const { date, startTime, endTime, allDay } = parsed.data
  const startsAt = new Date(`${date}T${allDay ? '00:00' : (startTime ?? '09:00')}:00`)
  const endsAt = allDay ? null : endTime ? new Date(`${date}T${endTime}:00`) : null

  await insertEvent({
    userId: await getCurrentUserId(),
    title: parsed.data.title,
    startsAt,
    endsAt,
    allDay,
    location: parsed.data.location ?? null,
    note: parsed.data.note ?? null,
  })

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
  const parsed = z
    .object({
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

  await insertPlannedBlock({
    userId: await getCurrentUserId(),
    blockDate: parsed.data.blockDate,
    startTime: parsed.data.startTime,
    endTime: parsed.data.endTime,
    kind: parsed.data.kind,
    projectId: parsed.data.projectId ?? null,
    note: parsed.data.note ?? null,
  })

  revalidatePlanning()
  return { ok: true as const }
}

export async function removePlannedBlock(input: unknown) {
  const id = z.string().uuid().parse(input)
  await deletePlannedBlock(await getCurrentUserId(), id)
  revalidatePlanning()
  return { ok: true }
}
