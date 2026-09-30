import type { ChatInvite, ChatMember, ChatMessage, ChatRoom, MessagePage } from './types'

export type NewRoom = Omit<ChatRoom, 'lastMessageAt' | 'createdAt'>
export type NewMessage = Omit<ChatMessage, 'id' | 'createdAt' | 'deletedAt'> & {
  /** Supplied by the browser so a retried send returns the first message, not a second one. */
  clientId: string
}
export type NewInvite = Omit<ChatInvite, 'usedCount' | 'revokedAt' | 'createdAt'>

/**
 * Everything chat needs from a database, and nothing more.
 *
 * One port for four collections rather than four ports, because they are never
 * replaced separately: a room without its members is not a thing anyone would
 * implement. Swapping MongoDB for Postgres is a second file implementing this
 * and one line in `provider.ts`; no service moves and no call site knows which
 * one it got.
 *
 * **Nothing here decides who may read what.** The store is handed a room id
 * that `assertMember` has already vouched for, exactly as every repository in
 * this app is handed a `userId` the session already proved.
 */
export type ChatStore = {
  /** Short name, for logs and for saying which one is in use. */
  id: string

  // — rooms —
  createRoom: (room: NewRoom) => Promise<ChatRoom>
  findRoom: (roomId: string) => Promise<ChatRoom | null>
  /**
   * The other half of making a direct room safe. Two people tapping "message"
   * at the same moment must end with one conversation, so the insert races and
   * the loser reads back the winner's room rather than making a second one.
   */
  findRoomByDirectKey: (directKey: string) => Promise<ChatRoom | null>
  listRoomsFor: (userId: string) => Promise<ChatRoom[]>
  rotateDoorbell: (roomId: string) => Promise<string>
  touchRoom: (roomId: string, at: Date) => Promise<void>
  deleteRoom: (roomId: string) => Promise<void>

  // — members —
  addMember: (member: Omit<ChatMember, 'leftAt' | 'lastReadMessageId'>) => Promise<void>
  findMember: (roomId: string, userId: string) => Promise<ChatMember | null>
  listMembers: (roomId: string) => Promise<ChatMember[]>
  removeMember: (roomId: string, userId: string) => Promise<void>
  countMembers: (roomId: string) => Promise<number>
  markRead: (roomId: string, userId: string, messageId: string) => Promise<void>

  // — messages —
  appendMessage: (message: NewMessage) => Promise<ChatMessage>
  /** Newest first. What "load older" asks for. */
  listBackward: (
    roomId: string,
    page: { before?: string | null; limit: number },
  ) => Promise<MessagePage>
  /** Oldest first, strictly after the cursor. What the doorbell asks for. */
  listForward: (
    roomId: string,
    page: { after?: string | null; limit: number },
  ) => Promise<MessagePage>
  /** Answers false when the message is not this person's to delete. */
  softDeleteMessage: (roomId: string, messageId: string, userId: string) => Promise<boolean>

  // — invites —
  createInvite: (invite: NewInvite) => Promise<ChatInvite>
  findInvite: (code: string) => Promise<ChatInvite | null>
  /** Spends one use, atomically. False when it was expired, revoked or spent. */
  useInvite: (code: string, now: Date) => Promise<boolean>
  revokeInvite: (code: string) => Promise<void>
  listInvites: (roomId: string) => Promise<ChatInvite[]>
  /** Invites addressed to someone who has just signed in for the first time. */
  findInvitesForEmail: (email: string, now: Date) => Promise<ChatInvite[]>

  // — erasure —
  /**
   * Cuts a person out of what they wrote without taking the words with them.
   * MongoDB has no cascade, so this is the whole of the guarantee: whatever is
   * not named here outlives the account.
   */
  anonymiseMessagesOf: (userId: string) => Promise<void>
  /** Returns the rooms the person was in, so empty ones can be swept after. */
  removeMembershipsOf: (userId: string) => Promise<string[]>
  deleteInvitesBy: (userId: string) => Promise<void>
  deleteMessagesIn: (roomId: string) => Promise<void>
}

/**
 * Used where no database is configured, so no caller needs a null check and
 * every screen behaves as if the feature were never built.
 */
export const NO_CHAT: ChatStore = {
  id: 'none',
  createRoom: async (room) => ({
    ...room,
    lastMessageAt: null,
    createdAt: new Date().toISOString(),
  }),
  findRoom: async () => null,
  findRoomByDirectKey: async () => null,
  listRoomsFor: async () => [],
  rotateDoorbell: async () => '',
  touchRoom: async () => {},
  deleteRoom: async () => {},
  addMember: async () => {},
  findMember: async () => null,
  listMembers: async () => [],
  removeMember: async () => {},
  countMembers: async () => 0,
  markRead: async () => {},
  appendMessage: async () => {
    throw new Error('chat is not configured')
  },
  listBackward: async () => ({ items: [], cursor: null, more: false }),
  listForward: async () => ({ items: [], cursor: null, more: false }),
  softDeleteMessage: async () => false,
  createInvite: async () => {
    throw new Error('chat is not configured')
  },
  findInvite: async () => null,
  useInvite: async () => false,
  revokeInvite: async () => {},
  listInvites: async () => [],
  findInvitesForEmail: async () => [],
  anonymiseMessagesOf: async () => {},
  removeMembershipsOf: async () => [],
  deleteInvitesBy: async () => {},
  deleteMessagesIn: async () => {},
}

/**
 * An in-memory store, for tests. It lives beside the port rather than in the
 * test folder on purpose: it is the executable statement of what an adapter
 * must do, and a new adapter is checked against the same suite.
 */
export function inMemoryChatStore(): ChatStore {
  const rooms = new Map<string, ChatRoom>()
  const members: ChatMember[] = []
  const messages: (ChatMessage & { clientId: string })[] = []
  const invites = new Map<string, ChatInvite>()
  let seq = 0

  /** Ids sort the way they were made, which is what both cursors rely on. */
  const nextId = () => String(++seq).padStart(12, '0')
  /**
   * Nothing leaves here by reference. A real database hands back a copy, and a
   * fake that hands back its own state lets a caller edit the store by
   * accident — and lets a test watch a value change under it.
   */
  const copy = <T>(value: T): T => structuredClone(value)
  const seatIn = (roomId: string, userId: string) =>
    members.find((m) => m.roomId === roomId && m.userId === userId)
  const live = (roomId: string) => messages.filter((m) => m.roomId === roomId)

  /** One row past the limit is how a page knows another exists, without counting. */
  const page = (rows: ChatMessage[], limit: number): MessagePage => {
    const items = rows.slice(0, limit)
    return { items: items.map(copy), cursor: items.at(-1)?.id ?? null, more: rows.length > limit }
  }

  return {
    id: 'memory',

    createRoom: async (room) => {
      if (room.directKey && [...rooms.values()].some((r) => r.directKey === room.directKey)) {
        throw Object.assign(new Error('duplicate direct room'), { code: 11000 })
      }
      const made: ChatRoom = { ...room, lastMessageAt: null, createdAt: new Date().toISOString() }
      rooms.set(made.id, made)
      return copy(made)
    },
    findRoom: async (roomId) => copy(rooms.get(roomId) ?? null),
    findRoomByDirectKey: async (directKey) =>
      copy([...rooms.values()].find((r) => r.directKey === directKey) ?? null),
    listRoomsFor: async (userId) =>
      members
        .filter((m) => m.userId === userId && m.leftAt === null)
        .map((m) => rooms.get(m.roomId))
        .filter((r): r is ChatRoom => Boolean(r))
        .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''))
        .map(copy),
    rotateDoorbell: async (roomId) => {
      const room = rooms.get(roomId)
      if (!room) return ''
      room.doorbellKey = crypto.randomUUID()
      return room.doorbellKey
    },
    touchRoom: async (roomId, at) => {
      const room = rooms.get(roomId)
      if (room) room.lastMessageAt = at.toISOString()
    },
    deleteRoom: async (roomId) => {
      rooms.delete(roomId)
      for (let i = members.length - 1; i >= 0; i--) {
        if (members[i]?.roomId === roomId) members.splice(i, 1)
      }
    },

    addMember: async (member) => {
      if (seatIn(member.roomId, member.userId)) return
      members.push({ ...member, leftAt: null, lastReadMessageId: null })
    },
    findMember: async (roomId, userId) => copy(seatIn(roomId, userId) ?? null),
    listMembers: async (roomId) => members.filter((m) => m.roomId === roomId).map(copy),
    removeMember: async (roomId, userId) => {
      const seat = seatIn(roomId, userId)
      if (seat) seat.leftAt = new Date().toISOString()
    },
    countMembers: async (roomId) =>
      members.filter((m) => m.roomId === roomId && m.leftAt === null).length,
    markRead: async (roomId, userId, messageId) => {
      const seat = seatIn(roomId, userId)
      if (seat) seat.lastReadMessageId = messageId
    },

    appendMessage: async (message) => {
      const already = messages.find(
        (m) => m.roomId === message.roomId && m.clientId === message.clientId,
      )
      if (already) return copy(already)
      const made = {
        ...message,
        id: nextId(),
        createdAt: new Date().toISOString(),
        deletedAt: null,
      }
      messages.push(made)
      return copy(made)
    },
    listBackward: async (roomId, { before, limit }) => {
      const rows = live(roomId)
        .filter((m) => (before ? m.id < before : true))
        .sort((a, b) => b.id.localeCompare(a.id))
        .slice(0, limit + 1)
      return page(rows, limit)
    },
    listForward: async (roomId, { after, limit }) => {
      const rows = live(roomId)
        .filter((m) => (after ? m.id > after : true))
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, limit + 1)
      return page(rows, limit)
    },
    softDeleteMessage: async (roomId, messageId, userId) => {
      const found = messages.find(
        (m) => m.id === messageId && m.roomId === roomId && m.userId === userId,
      )
      if (!found || found.deletedAt) return false
      found.deletedAt = new Date().toISOString()
      found.body = ''
      return true
    },

    createInvite: async (invite) => {
      const made: ChatInvite = {
        ...invite,
        usedCount: 0,
        revokedAt: null,
        createdAt: new Date().toISOString(),
      }
      invites.set(made.code, made)
      return copy(made)
    },
    findInvite: async (code) => copy(invites.get(code) ?? null),
    useInvite: async (code, now) => {
      const invite = invites.get(code)
      if (!invite) return false
      if (invite.revokedAt) return false
      if (new Date(invite.expiresAt) <= now) return false
      if (invite.usedCount >= invite.maxUses) return false
      invite.usedCount += 1
      return true
    },
    revokeInvite: async (code) => {
      const invite = invites.get(code)
      if (invite) invite.revokedAt = new Date().toISOString()
    },
    listInvites: async (roomId) =>
      [...invites.values()].filter((i) => i.roomId === roomId).map(copy),
    findInvitesForEmail: async (email, now) =>
      [...invites.values()]
        .filter(
          (i) =>
            i.email === email.toLowerCase() &&
            !i.revokedAt &&
            new Date(i.expiresAt) > now &&
            i.usedCount < i.maxUses,
        )
        .map(copy),

    anonymiseMessagesOf: async (userId) => {
      for (const message of messages) if (message.userId === userId) message.userId = null
    },
    removeMembershipsOf: async (userId) => {
      const touched = new Set<string>()
      for (let i = members.length - 1; i >= 0; i--) {
        const seat = members[i]
        if (seat?.userId !== userId) continue
        touched.add(seat.roomId)
        members.splice(i, 1)
      }
      return [...touched]
    },
    deleteInvitesBy: async (userId) => {
      for (const [code, invite] of invites) if (invite.createdBy === userId) invites.delete(code)
    },
    deleteMessagesIn: async (roomId) => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.roomId === roomId) messages.splice(i, 1)
      }
    },
  }
}
