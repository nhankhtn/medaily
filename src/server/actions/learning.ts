'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { PATHS } from '@/lib/paths'
import { isoDateSchema } from '@/lib/validation/daily'
import {
  deleteSession,
  findSessionDate,
  findTopic,
  insertTopic,
  updateSession,
  updateTopic,
  upsertResource,
} from '@/server/repositories/learning'
import { saveSessionAndDerive } from '@/server/services/focus'
import { recomputeDerivedHabitLogs } from '@/server/services/habit-derivation'
import { getSettings } from '@/server/services/settings'

const kindSchema = z.enum(['learning', 'deep_work', 'project'])
const optionalId = z.string().uuid().nullable().optional()
const optionalNote = z
  .string()
  .max(2000)
  .transform((value) => (value.trim() === '' ? null : value.trim()))
  .nullable()
  .optional()

function revalidateLearning(date?: string) {
  revalidatePath(PATHS.learning)
  revalidatePath(PATHS.home)
  revalidatePath(PATHS.daily)
  revalidatePath(PATHS.analytics)
  revalidatePath(PATHS.projects)
  if (date) revalidatePath(PATHS.dailyOn(date))
}

const sessionSchema = z.object({
  date: isoDateSchema,
  minutes: z.number().int().min(1).max(1440),
  kind: kindSchema,
  topicId: optionalId,
  projectId: optionalId,
  note: optionalNote,
})

export async function saveSession(input: unknown) {
  const parsed = sessionSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const settings = await getSettings()
  await saveSessionAndDerive({
    userId: settings.userId,
    sessionDate: parsed.data.date,
    minutes: parsed.data.minutes,
    kind: parsed.data.kind,
    topicId: parsed.data.topicId ?? null,
    projectId: parsed.data.projectId ?? null,
    note: parsed.data.note ?? null,
    source: 'manual',
    weekStart: settings.weekStart,
  })

  revalidateLearning(parsed.data.date)
  return { ok: true as const }
}

export async function removeSession(input: unknown) {
  const id = z.string().uuid().parse(input)
  const settings = await getSettings()
  const date = await findSessionDate(settings.userId, id)

  await db.transaction(async (tx) => {
    await deleteSession(settings.userId, id)
    if (date) await recomputeDerivedHabitLogs(tx, settings.userId, date, settings.weekStart)
  })

  revalidateLearning(date ?? undefined)
  return { ok: true }
}

export async function editSession(input: unknown) {
  const parsed = z
    .object({
      id: z.string().uuid(),
      minutes: z.number().int().min(1).max(1440),
      note: optionalNote,
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const }

  const settings = await getSettings()
  const updated = await updateSession(settings.userId, parsed.data.id, {
    minutes: parsed.data.minutes,
    note: parsed.data.note ?? null,
  })

  await db.transaction((tx) =>
    recomputeDerivedHabitLogs(tx, settings.userId, updated.sessionDate, settings.weekStart),
  )

  revalidateLearning(updated.sessionDate)
  return { ok: true as const }
}

const topicSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  category: z
    .string()
    .max(60)
    .transform((value) => value.trim() || null)
    .nullable()
    .optional(),
})

export async function saveTopic(input: unknown) {
  const parsed = topicSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const userId = await getCurrentUserId()
  const { id, name, category } = parsed.data

  if (id) {
    if (!(await findTopic(userId, id))) return { ok: false as const, error: 'not_found' as const }
    await updateTopic(userId, id, { name, category: category ?? null })
    revalidateLearning()
    return { ok: true as const, id }
  }

  const topic = await insertTopic({ userId, name, category: category ?? null })
  revalidateLearning()
  return { ok: true as const, id: topic.id }
}

/**
 * Archived, never deleted: the sessions filed under it keep their attribution,
 * so last month's "12 hours on Postgres" does not become 12 hours on nothing.
 */
export async function archiveTopic(input: unknown) {
  const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const userId = await getCurrentUserId()
  if (!(await findTopic(userId, parsed.data.id))) {
    return { ok: false as const, error: 'not_found' as const }
  }

  await updateTopic(userId, parsed.data.id, { archivedAt: new Date() })
  revalidateLearning()
  return { ok: true as const }
}

const resourceSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(['book', 'course', 'article', 'video', 'other']).default('book'),
  title: z.string().min(1).max(300),
  author: optionalNote,
  url: optionalNote,
  status: z.enum(['backlog', 'in_progress', 'done', 'dropped']).default('backlog'),
  progressPercent: z.number().int().min(0).max(100).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  topicId: optionalId,
})

export async function saveResource(input: unknown) {
  const parsed = resourceSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  await upsertResource(await getCurrentUserId(), {
    ...parsed.data,
    author: parsed.data.author ?? null,
    url: parsed.data.url ?? null,
    topicId: parsed.data.topicId ?? null,
  })

  revalidateLearning()
  return { ok: true as const }
}
