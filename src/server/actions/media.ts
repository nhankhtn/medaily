'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { PATHS } from '@/lib/paths'
import { isoDateSchema } from '@/lib/validation/daily'
import { findPerson } from '@/server/repositories/people'
import {
  deletePersonPhoto,
  findPersonPhoto,
  insertPersonPhoto,
  updatePersonPhoto,
} from '@/server/repositories/media'
import { createUploadTicket, destroyAsset, type UploadTicket } from '@/server/services/media'

export type TicketResult =
  | { ok: true; ticket: UploadTicket }
  | { ok: false; error: 'disabled' | 'not_found' | 'invalid_input' }

/**
 * Ownership is checked before a signature is handed out: a ticket names the
 * folder it may write to, so signing one for a person the caller does not own
 * would grant a write into someone else's gallery.
 */
export async function requestPhotoUpload(input: unknown): Promise<TicketResult> {
  const parsed = z.object({ personId: z.uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }

  const userId = await getCurrentUserId()
  if (!(await findPerson(userId, parsed.data.personId))) return { ok: false, error: 'not_found' }

  const ticket = createUploadTicket('people', userId, parsed.data.personId)
  if (!ticket) return { ok: false, error: 'disabled' }
  return { ok: true, ticket }
}

const attachSchema = z.object({
  personId: z.uuid(),
  publicId: z.string().min(1).max(300),
  format: z.string().max(20).nullable().optional(),
  width: z.number().int().positive().max(30_000).nullable().optional(),
  height: z.number().int().positive().max(30_000).nullable().optional(),
  bytes: z.number().int().nonnegative().max(100_000_000).nullable().optional(),
})

export async function attachPhoto(input: unknown) {
  const parsed = attachSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const userId = await getCurrentUserId()
  if (!(await findPerson(userId, parsed.data.personId))) {
    return { ok: false as const, error: 'not_found' as const }
  }

  // The browser reports the public id, so it is confined to the folder this
  // user's ticket authorised rather than trusted as given.
  const expectedPrefix = `${userId}/people/${parsed.data.personId}/`
  if (!parsed.data.publicId.includes(expectedPrefix)) {
    return { ok: false as const, error: 'invalid_input' as const }
  }

  await insertPersonPhoto({
    userId,
    personId: parsed.data.personId,
    publicId: parsed.data.publicId,
    format: parsed.data.format ?? null,
    width: parsed.data.width ?? null,
    height: parsed.data.height ?? null,
    bytes: parsed.data.bytes ?? null,
  })

  revalidatePath(PATHS.people)
  return { ok: true as const }
}

export async function removePhoto(input: unknown) {
  const parsed = z.object({ photoId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const userId = await getCurrentUserId()
  const photo = await findPersonPhoto(userId, parsed.data.photoId)
  if (!photo) return { ok: false as const, error: 'not_found' as const }

  await destroyAsset(photo.publicId)
  await deletePersonPhoto(userId, photo.id)

  revalidatePath(PATHS.people)
  return { ok: true as const }
}

export async function describePhoto(input: unknown) {
  const parsed = z
    .object({
      photoId: z.string().uuid(),
      caption: z.string().max(500).nullable().optional(),
      takenOn: isoDateSchema.nullable().optional(),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const userId = await getCurrentUserId()
  if (!(await findPersonPhoto(userId, parsed.data.photoId))) {
    return { ok: false as const, error: 'not_found' as const }
  }

  await updatePersonPhoto(userId, parsed.data.photoId, {
    caption: parsed.data.caption ?? null,
    takenOn: parsed.data.takenOn ?? null,
  })

  revalidatePath(PATHS.people)
  return { ok: true as const }
}
