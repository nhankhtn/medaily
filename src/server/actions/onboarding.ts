'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUserId } from '@/lib/auth/current-user'
import type { OnboardingState } from '@/lib/types'
import { findSettings, updateSettings } from '@/server/repositories/settings'

/**
 * Merges into the stored blob so one flag never erases the other. An explicit
 * `undefined` in the patch removes that key rather than writing a null.
 */
async function patchOnboarding(patch: OnboardingState) {
  const userId = await getCurrentUserId()
  const settings = await findSettings(userId)

  const merged: OnboardingState = { ...(settings?.onboarding ?? {}), ...patch }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete merged[key as keyof OnboardingState]
  }

  await updateSettings(userId, { onboarding: merged })

  revalidatePath('/')
  revalidatePath('/settings')
}

/**
 * Finishing and skipping are the same outcome: do not show it unprompted again.
 * Clearing the request is part of that, or the tour would reopen every visit.
 */
export async function markTourSeen() {
  await patchOnboarding({ tourSeenAt: new Date().toISOString(), tourRequestedAt: undefined })
  return { ok: true }
}

export async function dismissChecklist() {
  await patchOnboarding({ checklistDismissedAt: new Date().toISOString() })
  return { ok: true }
}

/**
 * Settings offers this: request the tour and un-dismiss the checklist, so the
 * guidance comes back even for a user who already has plenty of data.
 */
export async function restartOnboarding() {
  const userId = await getCurrentUserId()
  await updateSettings(userId, { onboarding: { tourRequestedAt: new Date().toISOString() } })
  revalidatePath('/')
  revalidatePath('/settings')
  return { ok: true }
}
