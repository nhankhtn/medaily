'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { PATHS } from '@/lib/paths'
import { METRIC_KEYS } from '@/lib/types'
import {
  findCustomMetric,
  findCustomMetrics,
  insertCustomMetric,
  updateCustomMetric,
} from '@/server/repositories/custom-metrics'

export type MetricResult =
  { ok: true } | { ok: false; error: 'invalid_input' | 'not_found' | 'key_taken' | 'key_reserved' }

/**
 * The key is what a habit or a goal binds to, so it is a slug the user cannot
 * mistype later: lowercase, no spaces, and never one of the built-in names.
 */
const KEY = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z][a-z0-9_]*$/, 'lowercase letters, digits and underscores')

const metricSchema = z.object({
  id: z.uuid().optional(),
  key: KEY,
  labelEn: z.string().min(1).max(60),
  labelVi: z.string().min(1).max(60),
  type: z.enum(['number', 'boolean', 'scale', 'text', 'duration']),
  unit: z.string().max(20).nullable().optional(),
  min: z.number().finite().nullable().optional(),
  max: z.number().finite().nullable().optional(),
  aggregation: z.enum(['sum', 'avg', 'count_days', 'latest']),
  sortOrder: z.number().int().min(0).max(999).optional(),
})

export async function saveCustomMetric(input: unknown): Promise<MetricResult> {
  const parsed = metricSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }

  const { id, key, min, max, ...rest } = parsed.data
  if ((METRIC_KEYS as readonly string[]).includes(key)) return { ok: false, error: 'key_reserved' }

  const userId = await getCurrentUserId()
  const existing = await findCustomMetrics(userId)
  if (existing.some((metric) => metric.key === key && metric.id !== id)) {
    return { ok: false, error: 'key_taken' }
  }

  const values = {
    ...rest,
    key,
    unit: rest.unit ?? null,
    min: min === null || min === undefined ? null : String(min),
    max: max === null || max === undefined ? null : String(max),
  }

  if (id) {
    if (!(await findCustomMetric(userId, id))) return { ok: false, error: 'not_found' }
    await updateCustomMetric(userId, id, values)
  } else {
    await insertCustomMetric({ ...values, userId })
  }

  revalidatePath(PATHS.home, 'layout')
  return { ok: true }
}

/**
 * Archived rather than deleted: the days already logged against it stay
 * readable, and a goal that measured it does not lose its history.
 */
export async function archiveCustomMetric(input: unknown): Promise<MetricResult> {
  const parsed = z.object({ id: z.uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }

  const userId = await getCurrentUserId()
  if (!(await findCustomMetric(userId, parsed.data.id))) return { ok: false, error: 'not_found' }

  await updateCustomMetric(userId, parsed.data.id, { archivedAt: new Date() })
  revalidatePath(PATHS.home, 'layout')
  return { ok: true }
}
