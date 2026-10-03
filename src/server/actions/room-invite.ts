'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { PATHS } from '@/lib/paths'
import { createLimit } from '@/lib/rate-limit'
import { NotAMemberError } from '@/server/services/chat'
import {
  acceptMembershipInvite,
  declineMembershipInvite,
  findInviteCandidates,
  peekMembershipInvite,
  sendRoomInvite,
} from '@/server/services/room-invite'

const lookups = createLimit({ capacity: 30, refillMs: 60_000 })
const sends = createLimit({ capacity: 10, refillMs: 60 * 60_000 })

const roomId = z.string().min(1).max(64)

export async function searchInvitees(input: unknown) {
  const parsed = z.object({ roomId, query: z.string().max(200) }).safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid' as const }

  const userId = await getCurrentUserId()
  if (!lookups.take(userId).allowed) return { ok: false as const, error: 'rate_limited' as const }

  try {
    const people = await findInviteCandidates(userId, parsed.data.roomId, parsed.data.query)
    return { ok: true as const, people }
  } catch (error) {
    if (error instanceof NotAMemberError) return { ok: false as const, error: 'forbidden' as const }
    throw error
  }
}

export async function inviteMember(input: unknown) {
  const parsed = z.object({ roomId, userId: z.uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid' as const }

  const userId = await getCurrentUserId()
  if (!sends.take(userId).allowed) return { ok: false as const, error: 'rate_limited' as const }

  const result = await sendRoomInvite(userId, parsed.data.roomId, parsed.data.userId)
  if (result.ok) revalidatePath(PATHS.chat)
  return result
}

export async function peekMembership(id: string) {
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) return { ok: false as const }
  const invite = await peekMembershipInvite(await getCurrentUserId(), parsed.data)
  return invite ? { ok: true as const, invite } : { ok: false as const }
}

export async function acceptMembership(id: string) {
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) return { ok: false as const }
  const result = await acceptMembershipInvite(await getCurrentUserId(), parsed.data)
  if (result.ok) {
    revalidatePath(PATHS.home, 'layout')
    revalidatePath(PATHS.chat)
    revalidatePath(PATHS.chatRoom(result.roomId))
  }
  return result
}

export async function declineMembership(id: string) {
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success) return { ok: false as const }
  await declineMembershipInvite(await getCurrentUserId(), parsed.data)
  revalidatePath(PATHS.home, 'layout')
  revalidatePath(PATHS.chat)
  return { ok: true as const }
}
