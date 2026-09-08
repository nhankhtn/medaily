'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { logicalDateOf } from '@/lib/dates'
import { isoDateSchema } from '@/lib/validation/daily'
import {
  clearTimer,
  deleteSession,
  findSessionDate,
  findTimer,
  insertSession,
  insertTopic,
  startTimer as persistTimer,
  updateSession,
  upsertResource,
} from '@/server/repositories/learning'
import { recomputeDerivedHabitLogs } from '@/server/services/habit-derivation'
import { dayContextOf, getSettings } from '@/server/services/settings'

/** A forgotten timer is capped rather than silently recording a 14-hour day. */
const MAX_TIMER_MINUTES = 8 * 60

const kindSchema = z.enum(['learning', 'deep_work', 'project'])
const optionalId = z.string().uuid().nullable().optional()
const optionalNote = z
  .string()
  .max(2000)
  .transform((value) => (value.trim() === '' ? null : value.trim()))
  .nullable()
  .optional()

function revalidateLearning(date?: string) {
  revalidatePath('/learning')
  revalidatePath('/')
  revalidatePath('/daily')
  revalidatePath('/analytics')
  revalidatePath('/projects')
  if (date) revalidatePath(`/daily/${date}`)
}

/**
 * Sessions and the daily log must never disagree, so writing a session
 * recomputes that day's derived habits in the same transaction — the same rule
 * the daily save follows (spec 7.3).
 */
async function saveSessionAndDerive(values: {
  userId: string
  sessionDate: string
  minutes: number
  kind: 'learning' | 'deep_work' | 'project'
  topicId?: string | null
  projectId?: string | null
  note?: string | null
  source: 'timer' | 'manual'
  startedAt?: Date | null
  endedAt?: Date | null
  weekStart: 'monday' | 'sunday'
}) {
  const { weekStart, ...session } = values
  return db.transaction(async (tx) => {
    const saved = await insertSession(session)
    await recomputeDerivedHabitLogs(tx, session.userId, session.sessionDate, weekStart)
    return saved
  })
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

export async function startTimer(input: unknown) {
  const parsed = z
    .object({ kind: kindSchema, topicId: optionalId, projectId: optionalId, note: optionalNote })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const }

  await persistTimer({
    userId: getCurrentUserId(),
    startedAt: new Date(),
    kind: parsed.data.kind,
    topicId: parsed.data.topicId ?? null,
    projectId: parsed.data.projectId ?? null,
    note: parsed.data.note ?? null,
  })

  revalidateLearning()
  return { ok: true as const }
}

export async function stopTimer() {
  const settings = await getSettings()
  const timer = await findTimer(settings.userId)
  if (!timer) return { ok: false as const, error: 'not_running' as const }

  const endedAt = new Date()
  const rawMinutes = Math.round((endedAt.getTime() - timer.startedAt.getTime()) / 60_000)
  const capped = rawMinutes > MAX_TIMER_MINUTES
  const minutes = Math.max(1, Math.min(MAX_TIMER_MINUTES, rawMinutes))

  const sessionDate = logicalDateOf(timer.startedAt, dayContextOf(settings))

  await saveSessionAndDerive({
    userId: settings.userId,
    sessionDate,
    minutes,
    kind: timer.kind,
    topicId: timer.topicId,
    projectId: timer.projectId,
    note: timer.note,
    source: 'timer',
    startedAt: timer.startedAt,
    endedAt,
    weekStart: settings.weekStart,
  })

  await clearTimer(settings.userId)
  revalidateLearning(sessionDate)
  return { ok: true as const, minutes, capped }
}

export async function createTopic(input: unknown) {
  const parsed = z
    .object({ name: z.string().min(1).max(120), category: optionalNote })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const }

  const topic = await insertTopic({
    userId: getCurrentUserId(),
    name: parsed.data.name,
    category: parsed.data.category ?? null,
  })
  revalidateLearning()
  return { ok: true as const, id: topic.id }
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

  await upsertResource(getCurrentUserId(), {
    ...parsed.data,
    author: parsed.data.author ?? null,
    url: parsed.data.url ?? null,
    topicId: parsed.data.topicId ?? null,
  })

  revalidateLearning()
  return { ok: true as const }
}
