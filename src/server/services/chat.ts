import { pickChatStore } from '@/lib/chat/provider'
import type { ChatStore } from '@/lib/chat/store'
import type { ChatMember, ChatRoom } from '@/lib/chat/types'

/**
 * Every function here takes its store as an argument, defaulting to whichever
 * one is configured — the same shape the repositories use for a transaction
 * handle (`tx: DbOrTx = db`). A test hands in `inMemoryChatStore()` and needs
 * no mocking framework.
 */
export type WithStore = { store?: ChatStore }

/** Thrown, never returned: a caller that forgets to check must not read on. */
export class NotAMemberError extends Error {
  constructor() {
    super('not a member of this room')
    this.name = 'NotAMemberError'
  }
}

/**
 * The one authorization primitive chat adds to this app.
 *
 * Everywhere else, a row is this person's because the query said
 * `WHERE user_id = $1`. A room belongs to several people, so that sentence has
 * nowhere to go — this stands in its place, and it has to stand in *front* of
 * every read and every write. The store itself never decides access; it is
 * handed a room id that has already been vouched for.
 *
 * Somebody who has left is not a member. They can still be *named* by the
 * transcript — that is what `listMembers` is for — but they cannot read what
 * was said after they went.
 */
export async function assertMember(
  roomId: string,
  userId: string,
  { store = pickChatStore() }: WithStore = {},
): Promise<ChatMember> {
  const seat = await store.findMember(roomId, userId)
  if (!seat || seat.leftAt !== null) throw new NotAMemberError()
  return seat
}

/** The same check, where the answer is a fact rather than a refusal. */
export async function isMember(
  roomId: string,
  userId: string,
  options: WithStore = {},
): Promise<boolean> {
  try {
    await assertMember(roomId, userId, options)
    return true
  } catch {
    return false
  }
}

/**
 * Whether this person may invite others into the room.
 *
 * Only whoever made it, which is the whole of what `role` is for. A room whose
 * owner has erased their account can no longer be invited into — the right
 * answer, because the alternative is a link nobody is accountable for.
 */
export async function assertCanInvite(
  roomId: string,
  userId: string,
  options: WithStore = {},
): Promise<void> {
  const seat = await assertMember(roomId, userId, options)
  if (seat.role !== 'owner') throw new NotAMemberError()
}

/**
 * Takes a room down once the last person has gone.
 *
 * MongoDB has no cascade, so nothing does this for us and an empty room would
 * sit there forever holding a conversation nobody can reach. Called from
 * leaving and from erasure, both of which know a room may have just emptied.
 */
export async function sweepIfEmpty(
  roomId: string,
  { store = pickChatStore() }: WithStore = {},
): Promise<boolean> {
  if ((await store.countMembers(roomId)) > 0) return false
  await store.deleteMessagesIn(roomId)
  await store.deleteRoom(roomId)
  return true
}

/** The rooms this person is in, newest activity first. */
export async function listRooms(
  userId: string,
  { store = pickChatStore() }: WithStore = {},
): Promise<ChatRoom[]> {
  return store.listRoomsFor(userId)
}

/**
 * Takes a person out of chat, before the account row goes.
 *
 * MongoDB has no cascade, so this is the whole of the guarantee — and the
 * order is deliberate. Doing chat first leaves, at worst, documents pointing
 * at a user who still exists: re-running finishes the job. The other way round
 * leaves documents whose owner is gone, which nothing will ever come back for.
 *
 * What it does **not** do is delete what the person wrote. That was a choice:
 * the words stay in other people's conversations, with nothing pointing back
 * at who wrote them. The privacy notice says so in as many words, because it
 * is a weaker promise than the rest of the app makes.
 */
export async function eraseChat(
  userId: string,
  { store = pickChatStore() }: WithStore = {},
): Promise<void> {
  await store.anonymiseMessagesOf(userId)
  const emptied = await store.removeMembershipsOf(userId)
  await store.deleteInvitesBy(userId)
  for (const roomId of emptied) await sweepIfEmpty(roomId, { store })
}

/**
 * Rooms somebody was invited into by address, found when they first sign in.
 *
 * The invite was written without ever asking whether that address had an
 * account — which is what makes inviting leak-free — so this is where the two
 * ends finally meet.
 */
export async function claimInvitesFor(
  email: string | null,
  userId: string,
  { store = pickChatStore() }: WithStore = {},
): Promise<number> {
  if (!email) return 0

  const waiting = await store.findInvitesForEmail(email, new Date())
  let joined = 0

  for (const invite of waiting) {
    const seat = await store.findMember(invite.roomId, userId)
    if (seat && seat.leftAt === null) continue
    if (!(await store.useInvite(invite.code, new Date()))) continue
    await store.addMember({
      roomId: invite.roomId,
      userId,
      role: 'member',
      joinedAt: new Date().toISOString(),
    })
    joined += 1
  }

  return joined
}

/**
 * How much is waiting, per room.
 *
 * Two reads: the seats say where each person had got to, the messages say
 * what has arrived since. A room this person has left is not counted — they
 * are no longer in it, so nothing in it is theirs to read.
 */
export async function unreadByRoom(
  userId: string,
  { store = pickChatStore() }: WithStore = {},
): Promise<Record<string, number>> {
  const rooms = await store.listRoomsFor(userId)
  if (rooms.length === 0) return {}

  const seats = await Promise.all(rooms.map((room) => store.findMember(room.id, userId)))
  return store.countUnread(
    userId,
    rooms.map((room, index) => ({
      roomId: room.id,
      after: seats[index]?.lastReadMessageId ?? null,
    })),
  )
}

/**
 * How many rooms are waiting, for the badge beside the nav.
 *
 * Rooms, not messages: a number in the hundreds beside a menu item says
 * nothing a person can act on, while "three rooms want you" does.
 */
export async function unreadRooms(userId: string, options: WithStore = {}): Promise<number> {
  return Object.keys(await unreadByRoom(userId, options)).length
}

/**
 * What the shell needs: how many rooms are waiting, and which channels to
 * listen on so that number can change without a reload.
 *
 * Both come out of one read of the room list, because asking twice for the
 * same rooms on every page is a query nobody needed.
 */
export async function unreadForShell(
  userId: string,
  { store = pickChatStore() }: WithStore = {},
): Promise<{ rooms: number; channels: string[] }> {
  const rooms = await store.listRoomsFor(userId)
  if (rooms.length === 0) return { rooms: 0, channels: [] }

  const seats = await Promise.all(rooms.map((room) => store.findMember(room.id, userId)))
  const unread = await store.countUnread(
    userId,
    rooms.map((room, index) => ({
      roomId: room.id,
      after: seats[index]?.lastReadMessageId ?? null,
    })),
  )

  return { rooms: Object.keys(unread).length, channels: rooms.map((room) => room.doorbellKey) }
}
