'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { PATHS } from '@/lib/paths'
import {
  actionById,
  conflictsWith,
  isValidBinding,
  resolveBindings,
} from '@/lib/shortcuts'
import { findSettings, updateSettings } from '@/server/repositories/settings'

export type SaveResult =
  | { ok: true }
  | { ok: false; error: 'invalid_input' | 'unknown_action' | 'taken'; takenBy?: string }

/**
 * Only the keys that differ from the registry are stored, so a default that
 * changes later reaches everyone who never touched it.
 */
export async function setShortcut(input: unknown): Promise<SaveResult> {
  const parsed = z
    .object({ id: z.string().min(1).max(60), binding: z.string().min(1).max(40) })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }
  if (!actionById(parsed.data.id)) return { ok: false, error: 'unknown_action' }

  const binding = parsed.data.binding.trim().toLowerCase()
  if (!isValidBinding(binding)) return { ok: false, error: 'invalid_input' }

  const userId = await getCurrentUserId()
  const settings = await findSettings(userId)
  const resolved = resolveBindings(settings?.shortcuts)

  const clash = conflictsWith(resolved, parsed.data.id, binding)
  if (clash.length > 0) return { ok: false, error: 'taken', takenBy: clash[0] }

  await updateSettings(userId, {
    shortcuts: { ...(settings?.shortcuts ?? {}), [parsed.data.id]: binding },
  })

  revalidatePath(PATHS.home, 'layout')
  return { ok: true }
}

export async function resetShortcut(input: unknown): Promise<SaveResult> {
  const parsed = z.object({ id: z.string().min(1).max(60) }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }

  const userId = await getCurrentUserId()
  const settings = await findSettings(userId)
  const { [parsed.data.id]: _removed, ...rest } = settings?.shortcuts ?? {}

  await updateSettings(userId, { shortcuts: rest })
  revalidatePath(PATHS.home, 'layout')
  return { ok: true }
}

export async function resetAllShortcuts(): Promise<SaveResult> {
  await updateSettings(await getCurrentUserId(), { shortcuts: {} })
  revalidatePath(PATHS.home, 'layout')
  return { ok: true }
}
