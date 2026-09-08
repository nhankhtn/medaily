'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { importPayload, type ImportSummary } from '@/server/services/export'

const MAX_IMPORT_BYTES = 25 * 1024 * 1024

/**
 * Spec 33 — a dry run reports what would be created before anything is
 * written, so an import is never a leap of faith.
 */
export async function importData(input: unknown): Promise<ImportSummary> {
  const parsed = z
    .object({ json: z.string().min(2).max(MAX_IMPORT_BYTES), dryRun: z.boolean().default(true) })
    .safeParse(input)

  if (!parsed.success) {
    return { ok: false, inserted: {}, skipped: {}, errors: ['invalid input'], dryRun: true }
  }

  let payload: unknown
  try {
    payload = JSON.parse(parsed.data.json)
  } catch {
    return { ok: false, inserted: {}, skipped: {}, errors: ['not valid JSON'], dryRun: true }
  }

  const summary = await importPayload(payload, parsed.data.dryRun)

  if (!summary.dryRun && summary.ok) {
    revalidatePath('/', 'layout')
  }
  return summary
}
