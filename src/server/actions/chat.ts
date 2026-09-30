'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { clientKey } from '@/lib/client-ip'
import { headers } from 'next/headers'
import { pickChatStore } from '@/lib/chat/provider'
import { directKeyOf, MESSAGE_PAGE } from '@/lib/chat/types'
import { PATHS } from '@/lib/paths'
import { createLimit } from '@/lib/rate-limit'
import type { Speaker } from '@/lib/chat/types'
import { listIdentities, findUsersByIds } from '@/server/repositories/auth'
import {
  assertCanInvite,
  assertMember,
  NotAMemberError,
  sweepIfEmpty,
} from '@/server/services/chat'
import { newInviteCode } from '@/lib/chat/invite-code'
import { audited } from '@/server/services/audited'

/** A conversation, not a firehose. Generous for typing, useless for flooding. */
const sends = createLimit({ capacity: 30, refillMs: 60_000 })
/** A link is a credential; handing them out is not something to do in bulk. */
const inviteWrites = createLimit({ capacity: 10, refillMs: 60 * 60_000 })

/** Bounded, and the caller loops. See `MessagePage.more`. */
const CATCH_UP_PAGE = 100

const roomIdSchema = z.string().min(1).max(64)
const messageIdSchema = z.string().min(1).max(64)

/**
 * Who said what, resolved once per room rather than once per page.
 *
 * Everyone who ever spoke in a room is on its roster, so a page of messages
 * costs no extra query. A sender the roster cannot name is someone who erased
 * their account; the screen renders that, it does not fail on it.
 */
export async function loadRoom(input: unknown) {
  const parsed = roomIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const store = pickChatStore()
  const userId = await getCurrentUserId()
  if (!(await allowed(parsed.data, userId)))
    return { ok: false as const, error: 'not_found' as const }

  const [room, members, page] = await Promise.all([
    store.findRoom(parsed.data),
    store.listMembers(parsed.data),
    store.listBackward(parsed.data, { limit: MESSAGE_PAGE }),
  ])
  if (!room) return { ok: false as const, error: 'not_found' as const }

  return {
    ok: true as const,
    room,
    speakers: await speakersOf(members.map((m) => m.userId)),
    // Oldest first for the screen; the store reads newest first because that
    // is the page you want, not the order you read it in.
    page: { ...page, items: [...page.items].reverse() },
  }
}

export async function loadOlderMessages(input: unknown) {
  const parsed = z.object({ roomId: roomIdSchema, before: messageIdSchema }).safeParse(input)
  if (!parsed.success) return { ok: false as const }

  const userId = await getCurrentUserId()
  if (!(await allowed(parsed.data.roomId, userId))) return { ok: false as const }

  const page = await pickChatStore().listBackward(parsed.data.roomId, {
    before: parsed.data.before,
    limit: MESSAGE_PAGE,
  })
  return { ok: true as const, ...page, items: [...page.items].reverse() }
}

/**
 * Everything after a cursor, one bounded page at a time.
 *
 * The caller must keep asking while `more` is true. Stopping at the first page
 * and keeping the cursor would step over messages that were never shown, and
 * nothing goes back for them.
 */
export async function loadNewMessages(input: unknown) {
  const parsed = z
    .object({ roomId: roomIdSchema, after: messageIdSchema.nullable() })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const }

  const userId = await getCurrentUserId()
  if (!(await allowed(parsed.data.roomId, userId))) return { ok: false as const }

  const store = pickChatStore()
  const [page, members] = await Promise.all([
    store.listForward(parsed.data.roomId, { after: parsed.data.after, limit: CATCH_UP_PAGE }),
    // The roster comes back too: somebody who joined since the screen opened
    // would otherwise have their messages rendered as nobody.
    store.listMembers(parsed.data.roomId),
  ])
  return { ok: true as const, ...page, speakers: await speakersOf(members.map((m) => m.userId)) }
}

export async function sendMessage(input: unknown) {
  const parsed = z
    .object({
      roomId: roomIdSchema,
      body: z.string().trim().min(1).max(4000),
      clientId: z.string().min(1).max(64),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const store = pickChatStore()
  const userId = await getCurrentUserId()
  try {
    await assertMember(parsed.data.roomId, userId, { store })
  } catch {
    return { ok: false as const, error: 'not_found' as const }
  }

  if (!sends.take(userId).allowed) return { ok: false as const, error: 'rate_limited' as const }

  const message = await store.appendMessage({
    roomId: parsed.data.roomId,
    userId,
    body: parsed.data.body,
    clientId: parsed.data.clientId,
  })
  await store.touchRoom(parsed.data.roomId, new Date())

  const room = await store.findRoom(parsed.data.roomId)
  revalidatePath(PATHS.chat)
  // The key rather than the room id: whoever holds it can be told the room
  // changed, and taking somebody out of the room takes that with them.
  return { ok: true as const, message, doorbellKey: room?.doorbellKey ?? null }
}

export async function deleteMessage(input: unknown) {
  const parsed = z.object({ roomId: roomIdSchema, messageId: messageIdSchema }).safeParse(input)
  if (!parsed.success) return { ok: false as const }

  const store = pickChatStore()
  const userId = await getCurrentUserId()
  try {
    await assertMember(parsed.data.roomId, userId, { store })
  } catch {
    return { ok: false as const }
  }

  const removed = await store.softDeleteMessage(parsed.data.roomId, parsed.data.messageId, userId)
  // The moment comes back so the screen can mark the row recalled without
  // inventing a time of its own.
  return removed ? { ok: true as const, at: new Date().toISOString() } : { ok: false as const }
}

export async function markRoomRead(input: unknown) {
  const parsed = z.object({ roomId: roomIdSchema, messageId: messageIdSchema }).safeParse(input)
  if (!parsed.success) return { ok: false as const }

  const store = pickChatStore()
  const userId = await getCurrentUserId()
  try {
    await assertMember(parsed.data.roomId, userId, { store })
  } catch {
    return { ok: false as const }
  }

  await store.markRead(parsed.data.roomId, userId, parsed.data.messageId)
  return { ok: true as const }
}

export const createRoom = audited('chatRoom.create', async (input: unknown) => {
  const parsed = z.object({ title: z.string().trim().min(1).max(120) }).safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const store = pickChatStore()
  const userId = await getCurrentUserId()
  const roomId = randomUUID()

  await store.createRoom({
    id: roomId,
    kind: 'group',
    title: parsed.data.title,
    createdBy: userId,
    doorbellKey: randomUUID(),
    directKey: null,
  })
  await store.addMember({ roomId, userId, role: 'owner', joinedAt: new Date().toISOString() })

  revalidatePath(PATHS.chat)
  return { ok: true as const, roomId }
})

/**
 * The conversation between two people, made at most once.
 *
 * Both of them tapping at the same moment is a race the database settles: the
 * loser's insert is refused by the unique key and it reads back what the
 * winner made, so there is never a second room to split the conversation.
 */
export async function openDirectRoom(input: unknown) {
  const parsed = z.object({ withUserId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const store = pickChatStore()
  const userId = await getCurrentUserId()
  if (parsed.data.withUserId === userId) {
    return { ok: false as const, error: 'invalid_input' as const }
  }

  const directKey = directKeyOf(userId, parsed.data.withUserId)
  const existing = await store.findRoomByDirectKey(directKey)
  if (existing) return { ok: true as const, roomId: existing.id }

  const roomId = randomUUID()
  try {
    await store.createRoom({
      id: roomId,
      kind: 'direct',
      title: null,
      createdBy: userId,
      doorbellKey: randomUUID(),
      directKey,
    })
  } catch {
    const won = await store.findRoomByDirectKey(directKey)
    if (!won) return { ok: false as const, error: 'failed' as const }
    return { ok: true as const, roomId: won.id }
  }

  const joinedAt = new Date().toISOString()
  await store.addMember({ roomId, userId, role: 'owner', joinedAt })
  await store.addMember({ roomId, userId: parsed.data.withUserId, role: 'member', joinedAt })

  revalidatePath(PATHS.chat)
  return { ok: true as const, roomId }
}

export const leaveRoom = audited('chatRoom.leave', async (input: unknown) => {
  const parsed = roomIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const }

  const store = pickChatStore()
  const userId = await getCurrentUserId()
  try {
    await assertMember(parsed.data, userId, { store })
  } catch {
    return { ok: false as const }
  }

  await store.removeMember(parsed.data, userId)
  // Nothing else would: MongoDB has no cascade, and an empty room holds a
  // conversation nobody can reach.
  await sweepIfEmpty(parsed.data, { store })

  revalidatePath(PATHS.chat)
  return { ok: true as const }
})

export const removeMember = audited('chatRoom.remove', async (input: unknown) => {
  const parsed = z.object({ roomId: roomIdSchema, userId: z.string().uuid() }).safeParse(input)
  if (!parsed.success) return { ok: false as const }

  const store = pickChatStore()
  const userId = await getCurrentUserId()
  try {
    await assertCanInvite(parsed.data.roomId, userId, { store })
  } catch {
    return { ok: false as const }
  }
  if (parsed.data.userId === userId) return { ok: false as const }

  await store.removeMember(parsed.data.roomId, parsed.data.userId)
  // Someone taken out of a room must stop being able to hear it ring.
  await store.rotateDoorbell(parsed.data.roomId)

  revalidatePath(PATHS.chat)
  return { ok: true as const }
})

const INVITE_HOURS = 48

/**
 * A way in, for a link or for an address.
 *
 * **No user is looked up.** An address is written down whether or not anyone
 * is using it, so there is no branch for a timing difference to leak and the
 * answer is the same sentence either way. The match happens when that person
 * next signs in — which also means an address can be invited before its owner
 * has an account at all.
 */
export const createInvite = audited('chatRoom.invite', async (input: unknown) => {
  const parsed = z
    .object({
      roomId: roomIdSchema,
      email: z.string().trim().max(200).optional(),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const store = pickChatStore()
  const userId = await getCurrentUserId()
  try {
    await assertCanInvite(parsed.data.roomId, userId, { store })
  } catch {
    return { ok: false as const, error: 'not_allowed' as const }
  }
  if (!inviteWrites.take(userId).allowed) {
    return { ok: false as const, error: 'rate_limited' as const }
  }

  const email = parsed.data.email?.toLowerCase() || null
  const invite = await store.createInvite({
    code: newInviteCode(),
    roomId: parsed.data.roomId,
    createdBy: userId,
    email,
    expiresAt: new Date(Date.now() + INVITE_HOURS * 3_600_000).toISOString(),
    maxUses: 1,
  })

  revalidatePath(PATHS.chatRoom(parsed.data.roomId))
  return { ok: true as const, code: invite.code, email }
})

export async function revokeInvite(input: unknown) {
  const parsed = z.object({ roomId: roomIdSchema, code: z.string().max(64) }).safeParse(input)
  if (!parsed.success) return { ok: false as const }

  const store = pickChatStore()
  const userId = await getCurrentUserId()
  try {
    await assertCanInvite(parsed.data.roomId, userId, { store })
  } catch {
    return { ok: false as const }
  }

  const invite = await store.findInvite(parsed.data.code)
  if (invite?.roomId !== parsed.data.roomId) return { ok: false as const }

  await store.revokeInvite(parsed.data.code)
  revalidatePath(PATHS.chatRoom(parsed.data.roomId))
  return { ok: true as const }
}

/**
 * Spends an invite and seats the person.
 *
 * Only ever from a POST. A link pasted into a chat app is fetched by its
 * preview bot before a human sees it, and a single-use invite opened that way
 * would already be gone by the time it was clicked.
 */
export const acceptInvite = audited('chatRoom.join', async (input: unknown) => {
  const parsed = z.string().min(1).max(64).safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'not_found' as const }

  const store = pickChatStore()
  const userId = await getCurrentUserId()
  if (!joins.take(clientKey(await headers())).allowed) {
    return { ok: false as const, error: 'rate_limited' as const }
  }

  const invite = await store.findInvite(parsed.data)
  if (!invite) return { ok: false as const, error: 'not_found' as const }

  const already = await store.findMember(invite.roomId, userId)
  if (already && already.leftAt === null) {
    return { ok: true as const, roomId: invite.roomId, alreadyIn: true }
  }

  if (!(await store.useInvite(parsed.data, new Date()))) {
    return { ok: false as const, error: 'not_found' as const }
  }

  await store.addMember({
    roomId: invite.roomId,
    userId,
    role: 'member',
    joinedAt: new Date().toISOString(),
  })

  revalidatePath(PATHS.chat)
  return { ok: true as const, roomId: invite.roomId, alreadyIn: false }
})

/**
 * What an invite is for, without spending it.
 *
 * The link used to land on a page of its own that said nothing but "join".
 * Naming the room is the whole difference between that and an answerable
 * question — nobody should have to accept an invitation to find out what they
 * are joining.
 *
 * `findInvite` reads; `useInvite` is what spends, and it is not called here.
 * So this stays safe to run on a page load, including the one a chat app's
 * preview bot triggers before a person has clicked anything.
 *
 * It shares the accept throttle and the same vague refusal: a stranger
 * guessing codes must not learn which ones exist from a friendlier answer.
 */
export async function peekInvite(input: unknown) {
  const parsed = z.string().min(1).max(64).safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'not_found' as const }

  if (!joins.take(clientKey(await headers())).allowed) {
    return { ok: false as const, error: 'rate_limited' as const }
  }

  const store = pickChatStore()
  const invite = await store.findInvite(parsed.data)
  if (!invite) return { ok: false as const, error: 'not_found' as const }

  const room = await store.findRoom(invite.roomId)
  if (!room) return { ok: false as const, error: 'not_found' as const }

  // Already in it: the dialog says so rather than offering to join twice.
  const member = await store.findMember(invite.roomId, await getCurrentUserId())

  return {
    ok: true as const,
    title: room.title,
    roomId: room.id,
    alreadyIn: Boolean(member && member.leftAt === null),
  }
}

/** Guessing codes is the one thing a stranger can try, so it is throttled by address. */
const joins = createLimit({ capacity: 20, refillMs: 15 * 60_000 })

async function allowed(roomId: string, userId: string): Promise<boolean> {
  try {
    await assertMember(roomId, userId, { store: pickChatStore() })
    return true
  } catch (error) {
    if (error instanceof NotAMemberError) return false
    throw error
  }
}

async function speakersOf(ids: string[]): Promise<Record<string, Speaker>> {
  const unique = [...new Set(ids)]
  const [rows, identities] = await Promise.all([
    findUsersByIds(unique),
    listIdentities({ userIds: unique, provider: 'google' }),
  ])

  // One Google identity per person here — the unique index is on
  // (provider, provider_uid), so a second row for the same user would mean two
  // Google accounts linked, and either uid identifies them equally well.
  const uidOf = new Map(identities.map((row) => [row.userId, row.providerUid]))

  return Object.fromEntries(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.displayName,
        imageUrl: row.imageUrl ?? null,
        firebaseUid: uidOf.get(row.id) ?? null,
      },
    ]),
  )
}
