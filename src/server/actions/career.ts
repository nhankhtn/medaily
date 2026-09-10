'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { isoDateSchema } from '@/lib/validation/daily'
import {
  insertAchievement,
  insertPortfolioItem,
  upsertSkill,
} from '@/server/repositories/career'

const optionalText = z
  .string()
  .max(4000)
  .transform((value) => (value.trim() === '' ? null : value.trim()))
  .nullable()
  .optional()

export async function saveSkill(input: unknown) {
  const parsed = z
    .object({
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(120),
      category: optionalText,
      level: z.number().int().min(1).max(5),
      targetLevel: z.number().int().min(1).max(5).nullable().optional(),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  await upsertSkill(await getCurrentUserId(), {
    ...parsed.data,
    category: parsed.data.category ?? null,
    targetLevel: parsed.data.targetLevel ?? null,
  })

  revalidatePath('/career')
  return { ok: true as const }
}

export async function saveAchievement(input: unknown) {
  const parsed = z
    .object({
      title: z.string().min(1).max(200),
      achievedOn: isoDateSchema,
      description: optionalText,
      impact: optionalText,
      link: optionalText,
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  await insertAchievement({
    userId: await getCurrentUserId(),
    title: parsed.data.title,
    achievedOn: parsed.data.achievedOn,
    description: parsed.data.description ?? null,
    impact: parsed.data.impact ?? null,
    link: parsed.data.link ?? null,
  })

  revalidatePath('/career')
  return { ok: true as const }
}

export async function savePortfolioItem(input: unknown) {
  const parsed = z
    .object({
      title: z.string().min(1).max(200),
      url: optionalText,
      description: optionalText,
      tech: z.array(z.string().min(1).max(40)).max(20).optional(),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  await insertPortfolioItem({
    userId: await getCurrentUserId(),
    title: parsed.data.title,
    url: parsed.data.url ?? null,
    description: parsed.data.description ?? null,
    tech: parsed.data.tech ?? null,
  })

  revalidatePath('/career')
  return { ok: true as const }
}
