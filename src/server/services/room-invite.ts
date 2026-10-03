import { createTranslator } from 'next-intl'
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/config'
import { pickChatStore } from '@/lib/chat/provider'
import type { RoomInvite, User } from '@/lib/db/schema'
import { log } from '@/lib/log'
import { presentNotification } from '@/lib/notifications'
import { findUserById, searchUsers } from '@/server/repositories/auth'
import { insertNotifications, markNotificationsReadByKey } from '@/server/repositories/notifications'
import {
  answerRoomInvite,
  findPendingRoomInvite,
  findRoomInvite,
  insertRoomInvite,
} from '@/server/repositories/room-invites'
import { findSettings } from '@/server/repositories/settings'
import { assertCanInvite, NotAMemberError } from '@/server/services/chat'
import { notify } from '@/server/services/push'

export type InviteCandidate = {
  id: string
  displayName: string
  username: string | null
  /** Shown only when they were found by the address that was typed. */
  email: string | null
}

/** The people a handle or an address could mean, minus anyone already in the room. */
export async function findInviteCandidates(
  userId: string,
  roomId: string,
  query: string,
): Promise<InviteCandidate[]> {
  const store = pickChatStore()
  await assertCanInvite(roomId, userId, { store })
  const seated = (await store.listMembers(roomId))
    .filter((member) => member.leftAt === null)
    .map((member) => member.userId)
  const needle = query.trim().toLowerCase()
  const rows = await searchUsers(query, [...seated, userId])
  return rows.map((row) => toCandidate(row, needle.includes('@')))
}

export type SendInviteResult =
  | { ok: true }
  | { ok: false; error: 'not_found' | 'already_member' | 'already_invited' | 'forbidden' }

/** Offer one person a seat, and tell them. */
export async function sendRoomInvite(
  userId: string,
  roomId: string,
  inviteeId: string,
): Promise<SendInviteResult> {
  if (inviteeId === userId) return { ok: false, error: 'not_found' }
  const store = pickChatStore()
  try {
    await assertCanInvite(roomId, userId, { store })
  } catch (error) {
    if (error instanceof NotAMemberError) return { ok: false, error: 'forbidden' }
    throw error
  }
  const seated = (await store.listMembers(roomId)).some(
    (member) => member.userId === inviteeId && member.leftAt === null,
  )
  if (seated) return { ok: false, error: 'already_member' }
  const invitee = await findUserById(inviteeId)
  const inviter = await findUserById(userId)
  if (!invitee || !inviter) return { ok: false, error: 'not_found' }
  if (await findPendingRoomInvite(roomId, inviteeId)) return { ok: false, error: 'already_invited' }

  let invite: RoomInvite | null
  try {
    invite = await insertRoomInvite({ roomId, inviterId: userId, inviteeId })
  } catch (error) {
    if (isUnique(error)) return { ok: false, error: 'already_invited' }
    throw error
  }
  if (!invite) return { ok: false, error: 'already_invited' }

  const room = await store.findRoom(roomId)
  await announce(invite, invitee.id, inviter.displayName, room?.title ?? '')
  return { ok: true }
}

export type MembershipInvite = {
  id: string
  roomId: string
  roomTitle: string
  inviterName: string
}

/** The offer, when this account is the one it was sent to and it is still open. */
export async function peekMembershipInvite(
  userId: string,
  inviteId: string,
): Promise<MembershipInvite | null> {
  const invite = await openInvite(userId, inviteId)
  if (!invite) return null
  const inviter = await findUserById(invite.inviterId)
  const room = await pickChatStore().findRoom(invite.roomId)
  return {
    id: invite.id,
    roomId: invite.roomId,
    roomTitle: room?.title ?? '',
    inviterName: inviter?.displayName ?? '',
  }
}

export async function acceptMembershipInvite(
  userId: string,
  inviteId: string,
): Promise<{ ok: true; roomId: string } | { ok: false }> {
  const invite = await openInvite(userId, inviteId)
  if (!invite) return { ok: false }
  await pickChatStore().addMember({
    roomId: invite.roomId,
    userId,
    role: 'member',
    joinedAt: new Date().toISOString(),
  })
  await answerRoomInvite(invite.id, 'accepted')
  await markNotificationsReadByKey(userId, [`room-invite:${invite.id}`])
  return { ok: true, roomId: invite.roomId }
}

export async function declineMembershipInvite(userId: string, inviteId: string): Promise<void> {
  const invite = await openInvite(userId, inviteId)
  if (!invite) return
  await answerRoomInvite(invite.id, 'declined')
  await markNotificationsReadByKey(userId, [`room-invite:${invite.id}`])
}

async function openInvite(userId: string, inviteId: string): Promise<RoomInvite | null> {
  const invite = await findRoomInvite(inviteId)
  if (!invite || invite.inviteeId !== userId || invite.status !== 'pending') return null
  const room = await pickChatStore().findRoom(invite.roomId)
  return room ? invite : null
}

function toCandidate(row: User, byEmail: boolean): InviteCandidate {
  return {
    id: row.id,
    displayName: row.displayName,
    username: row.username,
    email: byEmail ? row.email : null,
  }
}

function isUnique(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : null
  const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : ''
  return code === '23505'
}

/** The inbox strings, in the invitee's language. The push is sent once. */
async function inboxCopy(locale: Locale) {
  const messages = (await import(`../../../messages/${locale}.json`)).default
  return createTranslator({ locale, messages, namespace: 'inbox' })
}

async function announce(
  invite: RoomInvite,
  inviteeId: string,
  inviterName: string,
  roomTitle: string,
): Promise<void> {
  const payload = {
    inviteId: invite.id,
    roomId: invite.roomId,
    roomTitle,
    inviterName,
  }
  const dedupeKey = `room-invite:${invite.id}`
  try {
    await insertNotifications([{ userId: inviteeId, kind: 'room_invite', payload, dedupeKey }])
    const settings = await findSettings(inviteeId)
    const locale = isLocale(settings?.locale) ? settings.locale : DEFAULT_LOCALE
    const notice = presentNotification(
      'room_invite',
      payload,
      locale,
      await inboxCopy(locale),
    )
    await notify([inviteeId], {
      title: notice.title,
      body: notice.body || notice.title,
      url: notice.url,
      tag: dedupeKey,
    })
  } catch (error) {
    await log.error('chat', 'invited, but could not notify', error)
  }
}
