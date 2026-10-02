'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { clientKey } from '@/lib/client-ip'
import { headers } from 'next/headers'
import { pickChatStore } from '@/lib/chat/provider'
import { getTranslations } from 'next-intl/server'
import { notifyRoom } from '@/server/services/chat-notify'
import { notify } from '@/server/services/push'
import { directKeyOf, MESSAGE_PAGE } from '@/lib/chat/types'
import { PATHS } from '@/lib/paths'
import { createLimit } from '@/lib/rate-limit'
import type { Speaker,
  ChatMember,} from '@/lib/chat/types'
import { listIdentities, findUsersByIds } from '@/server/repositories/auth'
import {
  assertCanInvite,
  assertMember,
  NotAMemberError,
  sweepIfEmpty,
} from '@/server/services/chat'
import { newInviteCode } from '@/lib/chat/invite-code'
import { isReaction, isSticker } from '@/lib/chat/stickers'
import { audited } from '@/server/services/audited'
import { createUploadTicket, destroyAsset } from '@/server/services/media'
import { readCloudinaryConfig } from '@/lib/media/cloudinary'
import { deliveryUrl, publicIdFromDeliveryUrl } from '@/lib/media/image-url'

/** A conversation, not a firehose. Generous for typing, useless for flooding. */
const sends = createLimit({ capacity: 30, refillMs: 60_000 })
/** A link is a credential; handing them out is not something to do in bulk. */
const inviteWrites = createLimit({ capacity: 10, refillMs: 60 * 60_000 })
/*
 * A nudge is a buzz in somebody's pocket with no words in it, so the only
 * thing stopping it being a weapon is this. Three, then a wait: enough to be
 * playful twice over, not enough to be used on somebody.
 */
const nudges = createLimit({ capacity: 3, refillMs: 5 * 60_000 })

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
/**
 * How far each other person in the room has read.
 *
 * Keyed by the message they stopped at, which is what a row of faces under a
 * bubble is drawn from. The asker is left out — your own mark is the bottom of
 * the screen and drawing yourself there says nothing — and so is anybody who
 * has left, or who has read nothing yet.
 */
function readsOf(members: ChatMember[], userId: string): Record<string, string> {
  const marks: Record<string, string> = {}
  for (const member of members) {
    if (member.userId === userId || member.leftAt !== null) continue
    if (member.lastReadMessageId) marks[member.userId] = member.lastReadMessageId
  }
  return marks
}

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
    // The seat, not `room.createdBy`: that column is nullable, so every room
    // made before it existed reports no owner at all and the person who made
    // it loses the menu. The server authorises on the seat, and a screen that
    // asks a different question than the server hides what it would allow.
    owner: members.find((m) => m.userId === userId)?.role === 'owner',
    speakers: await speakersOf(members.map((m) => m.userId)),
    reads: readsOf(members, userId),
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
/**
 * The newest page again, for changes rather than arrivals.
 *
 * Paging forward from a cursor only ever brings things that did not exist
 * before, so a recall or a reaction on a message already on screen would never
 * reach anybody else — they would keep reading words their author had taken
 * back. This re-reads the recent window so those land too.
 *
 * Bounded to one page on purpose: something changed further up than that is
 * picked up on the next scroll or reload, and the alternative is re-reading a
 * conversation of unknown length every time somebody taps an emoji.
 */
export async function loadRecentMessages(input: unknown) {
  const parsed = roomIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const }

  const userId = await getCurrentUserId()
  if (!(await allowed(parsed.data, userId))) return { ok: false as const }

  const store = pickChatStore()
  // The marks come back with the page, because this is the call a room makes
  // when something changed — and somebody else reading is a change, with
  // nothing else to carry it.
  const [page, members] = await Promise.all([
    store.listBackward(parsed.data, { limit: MESSAGE_PAGE }),
    store.listMembers(parsed.data),
  ])
  return { ok: true as const, items: [...page.items].reverse(), reads: readsOf(members, userId) }
}

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
      // A sticker's body is its id and nothing else. Checked against the pack
      // rather than trusted: without this the field is a way to store a string
      // that the room then renders as a picture.
      kind: z.enum(['text', 'sticker']).default('text'),
      body: z.string().trim().min(1).max(4000),
      clientId: z.string().min(1).max(64),
      replyToId: messageIdSchema.optional(),
    })
    .refine((value) => value.kind !== 'sticker' || isSticker(value.body), {
      message: 'unknown sticker',
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

  /*
   * Only a message from this room may be quoted. Without the check an id from
   * a room somebody is not in would come back resolved, and the quote is
   * rendered — which would turn a reply box into a way to read one line at a
   * time out of any conversation whose message ids you could guess.
   */
  let replyToId: string | undefined
  if (parsed.data.replyToId) {
    const quoted = await store.findMessage(parsed.data.roomId, parsed.data.replyToId)
    if (quoted) replyToId = quoted.id
  }

  const message = await store.appendMessage({
    roomId: parsed.data.roomId,
    userId,
    kind: parsed.data.kind,
    body: parsed.data.body,
    clientId: parsed.data.clientId,
    ...(replyToId ? { replyToId } : {}),
  })
  await store.touchRoom(parsed.data.roomId, new Date())

  const room = await store.findRoom(parsed.data.roomId)

  /*
   * Everyone in the room but the sender. Not awaited for its result and never
   * allowed to throw: a message that saved and did not buzz a phone is a worse
   * notification, not a failed send.
   *
   * The body goes in the payload rather than a count, because a notification
   * that says "1 new message" is one more tap to learn what a glance could
   * have told you. The device already holds the words of this conversation.
   */
  void notifyRoom({
    roomId: parsed.data.roomId,
    senderId: userId,
    title: room?.title ?? null,
    avatarUrl: room?.avatarUrl ?? null,
    kind: parsed.data.kind,
    body: parsed.data.body,
    store,
  })
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

/**
 * Adds or takes back one person's reaction.
 *
 * The emoji is checked against the fixed row rather than stored as given: this
 * writes a key into a document, and an open vocabulary would let anybody grow
 * it with whatever they liked.
 */
export async function toggleReaction(input: unknown) {
  const parsed = z
    .object({
      roomId: roomIdSchema,
      messageId: messageIdSchema,
      emoji: z.string().max(16).refine(isReaction, { message: 'unknown reaction' }),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const }

  const store = pickChatStore()
  const userId = await getCurrentUserId()
  try {
    await assertMember(parsed.data.roomId, userId, { store })
  } catch {
    return { ok: false as const }
  }

  const did = await store.toggleReaction(
    parsed.data.roomId,
    parsed.data.messageId,
    userId,
    parsed.data.emoji,
  )
  if (!did) return { ok: false as const }

  const room = await store.findRoom(parsed.data.roomId)
  return { ok: true as const, did, doorbellKey: room?.doorbellKey ?? null }
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
  // The badge lives in the shell, so clearing it means refreshing the layout
  // rather than the page — otherwise a room reads itself and the nav goes on
  // claiming it is waiting.
  revalidatePath(PATHS.home, 'layout')
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
  // Leaving is the same as being taken out: whoever walked away still holds
  // the old key, and must stop being able to hear the room ring.
  await store.rotateDoorbell(parsed.data)
  // Nothing else would: MongoDB has no cascade, and an empty room holds a
  // conversation nobody can reach.
  await sweepIfEmpty(parsed.data, { store })

  revalidatePath(PATHS.chat)
  return { ok: true as const }
})

export const renameRoom = audited('chatRoom.rename', async (input: unknown) => {
  const parsed = z
    .object({ roomId: roomIdSchema, title: z.string().trim().min(1).max(120) })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const }

  const store = pickChatStore()
  try {
    // Anyone in the room could be trusted with the name, but a room is read by
    // the list it sits in, and renaming it changes that line for everybody.
    await assertCanInvite(parsed.data.roomId, await getCurrentUserId(), { store })
  } catch {
    return { ok: false as const }
  }

  await store.renameRoom(parsed.data.roomId, parsed.data.title)

  revalidatePath(PATHS.chat)
  revalidatePath(PATHS.chatRoom(parsed.data.roomId))
  return { ok: true as const }
})

/**
 * Takes the room down for everybody, not just for the person asking.
 *
 * Owner only, and that is the difference from leaving: leaving is a decision
 * about yourself, and this one is made on behalf of people who are not here
 * to be asked. The messages go with it, because a room is the only way to
 * reach them and nothing else would ever collect them.
 */
/**
 * A group's picture.
 *
 * Not audited, and deliberately: the trail here is for the access-control
 * moments — who got in, who was put out — and a room's picture is neither.
 * Owner-only all the same, because it is the line everybody in the room reads
 * the conversation by.
 */
export async function requestRoomAvatarUpload(input: unknown) {
  const parsed = roomIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const store = pickChatStore()
  try {
    await assertCanInvite(parsed.data, await getCurrentUserId(), { store })
  } catch {
    return { ok: false as const, error: 'forbidden' as const }
  }

  // The folder is the room rather than the person, so the picture outlives
  // whoever happened to upload it and a later owner replaces the same asset.
  const ticket = createUploadTicket('rooms', await getCurrentUserId(), parsed.data)
  if (!ticket) return { ok: false as const, error: 'disabled' as const }
  return { ok: true as const, ticket }
}

export async function attachRoomAvatar(input: unknown) {
  const parsed = z
    .object({ roomId: roomIdSchema, publicId: z.string().min(1).max(300) })
    .safeParse(input)
  if (!parsed.success) return { ok: false as const }

  const store = pickChatStore()
  const userId = await getCurrentUserId()
  try {
    await assertCanInvite(parsed.data.roomId, userId, { store })
  } catch {
    return { ok: false as const }
  }

  // The signed ticket named this folder, but the browser sends back a public
  // id of its own choosing — so the id is held to the folder it was signed
  // for, or one room could be given a picture uploaded against another.
  if (!parsed.data.publicId.includes(`/rooms/${parsed.data.roomId}/`)) {
    return { ok: false as const }
  }

  const config = readCloudinaryConfig()
  if (!config.configured) return { ok: false as const }

  const room = await store.findRoom(parsed.data.roomId)
  await dropAvatarAsset(room?.avatarUrl ?? null, config.cloudName, parsed.data.publicId)
  await store.setRoomAvatar(
    parsed.data.roomId,
    deliveryUrl(config.cloudName, parsed.data.publicId, 'thumb'),
  )

  revalidatePath(PATHS.chat)
  revalidatePath(PATHS.chatRoom(parsed.data.roomId))
  return { ok: true as const }
}

export async function removeRoomAvatar(input: unknown) {
  const parsed = roomIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const }

  const store = pickChatStore()
  try {
    await assertCanInvite(parsed.data, await getCurrentUserId(), { store })
  } catch {
    return { ok: false as const }
  }

  const room = await store.findRoom(parsed.data)
  await dropAvatarAsset(room?.avatarUrl ?? null, readCloudinaryConfig().cloudName, null)
  await store.setRoomAvatar(parsed.data, null)

  revalidatePath(PATHS.chat)
  revalidatePath(PATHS.chatRoom(parsed.data))
  return { ok: true as const }
}

export const deleteRoom = audited('chatRoom.delete', async (input: unknown) => {
  const parsed = roomIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const }

  const store = pickChatStore()
  try {
    await assertCanInvite(parsed.data, await getCurrentUserId(), { store })
  } catch {
    return { ok: false as const }
  }

  await store.deleteMessagesIn(parsed.data)
  await store.deleteRoom(parsed.data)

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
  const parsed = z.object({ roomId: roomIdSchema }).safeParse(input)
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

  const invite = await store.createInvite({
    code: newInviteCode(),
    roomId: parsed.data.roomId,
    createdBy: userId,
    // Nothing writes an address onto an invite any more. The field is kept
    // because `acceptInvite` still honours one, which is what keeps the links
    // issued before this change restricted until they expire.
    email: null,
    expiresAt: new Date(Date.now() + INVITE_HOURS * 3_600_000).toISOString(),
    maxUses: 1,
  })

  revalidatePath(PATHS.chatRoom(parsed.data.roomId))
  return { ok: true as const, code: invite.code }
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

  // An invite written for an address is for that address. A forwarded link
  // must not seat whoever opens it first and spend the one use. Same answer
  // as an unknown code, so the link does not say who it was meant for.
  //
  // Nothing writes an address any more — the field that did read as sending an
  // invitation and sent nothing. This stays until the last invite carrying one
  // has expired, which is at most two days after that change shipped, because
  // dropping it would unlock every restricted link still in somebody's hands.
  if (invite.email) {
    const identities = await listIdentities({ userIds: [userId] })
    if (!identities.some((identity) => identity.email?.toLowerCase() === invite.email)) {
      return { ok: false as const, error: 'not_found' as const }
    }
  }

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
        // Mirrors `realtimeUidFor`, which decides the uid the token is
        // minted under — the two have to agree or a typing document lands
        // under a name no reader recognises.
        firebaseUid: uidOf.get(row.id) ?? row.id,
      },
    ]),
  )
}

/**
 * Lets go of the picture a room used to wear.
 *
 * Replacing is the only moment anything is deleted from Cloudinary here, and
 * a failure to delete is logged rather than raised: the room has its new face
 * either way, and an asset nobody points at costs storage, not correctness.
 */
async function dropAvatarAsset(
  previousUrl: string | null,
  cloudName: string,
  keep: string | null,
): Promise<void> {
  if (!previousUrl) return

  const previous = publicIdFromDeliveryUrl(previousUrl, cloudName)
  if (!previous || previous === keep) return

  try {
    await destroyAsset(previous)
  } catch (error) {
    console.error('[chat] could not delete the room picture it replaced:', error)
  }
}

/**
 * A buzz in somebody's pocket, with nothing in it.
 *
 * Every other notification this app sends is about something that happened:
 * words arrived, and the notification carries them. This one is the thing
 * itself — the whole message is that somebody wanted your attention — so it
 * needs no body, and the limit above is what keeps it from being an argument.
 *
 * Silent where nobody has turned notifications on. There is nothing to show in
 * the room either: a nudge that left a line behind would be a message, and a
 * message is what the composer is for.
 */
export async function nudgeRoom(input: unknown) {
  const parsed = roomIdSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const store = pickChatStore()
  const userId = await getCurrentUserId()
  if (!(await allowed(parsed.data, userId))) return { ok: false as const, error: 'not_found' as const }

  // Per room, not per person: being quiet in one conversation should not be
  // the price of having been playful in another.
  if (!nudges.take(`${userId}:${parsed.data}`).allowed) {
    return { ok: false as const, error: 'rate_limited' as const }
  }

  const [members, [sender], t] = await Promise.all([
    store.listMembers(parsed.data),
    findUsersByIds([userId]),
    getTranslations('chat'),
  ])
  const audience = members
    .filter((member) => member.leftAt === null && member.userId !== userId)
    .map((member) => member.userId)
  if (audience.length === 0) return { ok: true as const }

  await notify(audience, {
    title: t('nudgePush', { name: sender?.displayName?.trim() || t('someone') }),
    body: '',
    url: PATHS.chatRoom(parsed.data),
    // Its own tag: a nudge replacing the message somebody has not read yet
    // would lose the thing that was actually said.
    tag: `nudge:${parsed.data}`,
    ...(sender?.imageUrl?.startsWith('https://') ? { icon: sender.imageUrl } : {}),
  })

  return { ok: true as const }
}
