import {
  previewOf,
  type ChatInvite,
  type ChatMember,
  type ChatMessage,
  type ChatRoom,
  type MessagePage,
  type RoomEncryption,
} from './types'
import { matches } from './search'

/** A room is always made faceless; the picture is set afterwards, if at all. */
export type NewRoom = Omit<ChatRoom, 'lastMessageAt' | 'createdAt' | 'avatarUrl' | 'encryption'> & {
  /** Fixed for the room's life: no method on this port changes it. */
  encryption: Exclude<RoomEncryption, 'legacy'>
}
export type NewMessage = Omit<
  ChatMessage,
  'id' | 'createdAt' | 'deletedAt' | 'reactions' | 'replyTo' | 'editedAt'
> & {
  /** Supplied by the browser so a retried send returns the first message, not a second one. */
  clientId: string
  /** The message being answered. Only the id is stored; the quote is resolved on read. */
  replyToId?: string | null
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
  renameRoom: (roomId: string, title: string) => Promise<void>
  /** Null clears it. The caller destroys whatever the old URL pointed at. */
  setRoomAvatar: (roomId: string, avatarUrl: string | null) => Promise<void>
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
  /**
   * How many messages each room holds that this person has not seen.
   *
   * Asked for every room at once rather than one at a time: the badge on the
   * nav needs all of them, and a query per room is a query per room on every
   * page load. Their own messages never count — sending something is not a
   * reason for the room to ask to be read.
   */
  countUnread: (
    userId: string,
    rooms: { roomId: string; after: string | null }[],
  ) => Promise<Record<string, number>>

  /**
   * Scoped to its room, which is what stops a quote being used to read a
   * conversation you are not in, one line at a time.
   */
  findMessage: (roomId: string, messageId: string) => Promise<ChatMessage | null>

  /**
   * The same page as `listBackward`, without resolving what each one answers.
   *
   * For deciding, not for drawing. `replyTo` is always null here — not "this
   * message answered nothing", but "nobody asked". A screen that renders a
   * quote must use `listBackward`; this exists for the scan behind search,
   * which reads a thousand messages to show twenty and would otherwise spend
   * a second query and a second round of decryption per page building quotes
   * it throws away. Measured at a 50% reply rate: 270ms against 42ms.
   */
  scanBackward: (
    roomId: string,
    page: { before?: string | null; limit: number },
  ) => Promise<MessagePage>

  /**
   * Text messages matching a query, newest first, found by the database.
   * Only for a `plain` room — a locked body cannot be matched without opening
   * it, which is what `scanBackward` is for. `replyTo` is always null.
   */
  searchText: (
    roomId: string,
    page: { query: string; before?: string | null; limit: number },
  ) => Promise<MessagePage>

  /**
   * Who wrote the newest thing this person has not read, across every room.
   *
   * One question rather than one per room, and asked only when something is
   * waiting — it exists so a browser tab can say a name instead of a number,
   * and a name nobody is going to read is not worth a query.
   *
   * `null` when nothing is waiting, or when the writer has erased their
   * account and the message outlived them.
   */
  latestUnreadSender: (
    userId: string,
    rooms: { roomId: string; after: string | null }[],
  ) => Promise<string | null>

  /**
   * Rewrites the words, and says so on the message.
   *
   * Only the author, only text, and only while it is still there: a sticker's
   * body is an id and editing it means nothing, and a recalled message has no
   * words left to change. `null` when any of those is not true, which is the
   * same answer as "not yours" on purpose — the screen should not learn which
   * of them it was.
   */
  editMessage: (
    roomId: string,
    messageId: string,
    userId: string,
    body: string,
  ) => Promise<ChatMessage | null>

  /** Answers false when the message is not this person's to delete. */
  softDeleteMessage: (roomId: string, messageId: string, userId: string) => Promise<boolean>
  /**
   * **One per person**, enforced here rather than in the screen — two tabs
   * would walk past a rule enforced on the way in. Tapping the emoji already
   * chosen takes it back; `null` means no such message.
   */
  toggleReaction: (
    roomId: string,
    messageId: string,
    userId: string,
    emoji: string,
  ) => Promise<'added' | 'removed' | null>

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
    avatarUrl: null,
    lastMessageAt: null,
    createdAt: new Date().toISOString(),
  }),
  findRoom: async () => null,
  findRoomByDirectKey: async () => null,
  listRoomsFor: async () => [],
  rotateDoorbell: async () => '',
  touchRoom: async () => {},
  renameRoom: async () => {},
  setRoomAvatar: async () => {},
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
  scanBackward: async () => ({ items: [], cursor: null, more: false }),
  searchText: async () => ({ items: [], cursor: null, more: false }),
  countUnread: async () => ({}),
  latestUnreadSender: async () => null,
  findMessage: async () => null,
  editMessage: async () => null,
  softDeleteMessage: async () => false,
  toggleReaction: async () => null,
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
  /** `replyToId` is what is stored; `replyTo` is resolved on the way out. */
  const messages: (ChatMessage & { clientId: string; replyToId: string | null })[] = []
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

  /** Looked up, not copied at write time, so a quote follows a recall. */
  const withQuotes = (rows: (ChatMessage & { replyToId: string | null })[]): ChatMessage[] =>
    rows.map((row) => {
      const quoted = row.replyToId ? messages.find((m) => m.id === row.replyToId) : undefined
      return { ...row, replyTo: quoted ? previewOf(quoted) : null }
    })

  /** One row past the limit is how a page knows another exists, without counting. */
  const page = (
    rows: (ChatMessage & { replyToId: string | null })[],
    limit: number,
  ): MessagePage => {
    const items = withQuotes(rows.slice(0, limit))
    return { items: items.map(copy), cursor: items.at(-1)?.id ?? null, more: rows.length > limit }
  }

  return {
    id: 'memory',

    createRoom: async (room) => {
      if (room.directKey && [...rooms.values()].some((r) => r.directKey === room.directKey)) {
        throw Object.assign(new Error('duplicate direct room'), { code: 11000 })
      }
      const made: ChatRoom = {
        ...room,
        avatarUrl: null,
        lastMessageAt: null,
        createdAt: new Date().toISOString(),
      }
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
    renameRoom: async (roomId, title) => {
      const room = rooms.get(roomId)
      if (room) room.title = title
    },

    setRoomAvatar: async (roomId, avatarUrl) => {
      const room = rooms.get(roomId)
      if (room) room.avatarUrl = avatarUrl
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
        editedAt: null,
        reactions: {} as Record<string, string[]>,
        replyToId: message.replyToId ?? null,
        replyTo: null,
      }
      messages.push(made)
      return copy(withQuotes([made])[0]!)
    },
    findMessage: async (roomId, messageId) => {
      const found = messages.find((m) => m.id === messageId && m.roomId === roomId)
      return found ? copy(withQuotes([found])[0]!) : null
    },
    listBackward: async (roomId, { before, limit }) => {
      const rows = live(roomId)
        .filter((m) => (before ? m.id < before : true))
        .sort((a, b) => b.id.localeCompare(a.id))
        .slice(0, limit + 1)
      return page(rows, limit)
    },
    scanBackward: async (roomId, { before, limit }) => {
      // The fake has no quotes to resolve and no cost to save; it answers the
      // same shape so the contract can hold both stores to the same promise.
      const rows = live(roomId)
        .filter((m) => (before ? m.id < before : true))
        .sort((a, b) => b.id.localeCompare(a.id))
        .slice(0, limit + 1)
      const answered = page(rows, limit)
      return { ...answered, items: answered.items.map((m) => ({ ...m, replyTo: null })) }
    },
    searchText: async (roomId, { query, before, limit }) => {
      const rows = live(roomId)
        .filter((m) => m.kind === 'text' && m.deletedAt === null && matches(m.body, query))
        .filter((m) => (before ? m.id < before : true))
        .sort((a, b) => b.id.localeCompare(a.id))
        .slice(0, limit + 1)
      const answered = page(rows, limit)
      return { ...answered, items: answered.items.map((m) => ({ ...m, replyTo: null })) }
    },
    listForward: async (roomId, { after, limit }) => {
      const rows = live(roomId)
        .filter((m) => (after ? m.id > after : true))
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, limit + 1)
      return page(rows, limit)
    },
    countUnread: async (userId, rooms) => {
      const out: Record<string, number> = {}
      for (const { roomId, after } of rooms) {
        const n = messages.filter(
          (m) =>
            m.roomId === roomId &&
            m.userId !== userId &&
            m.deletedAt === null &&
            (after ? m.id > after : true),
        ).length
        if (n > 0) out[roomId] = n
      }
      return out
    },

    latestUnreadSender: async (userId, rooms) => {
      const waiting = messages.filter(
        (m) =>
          m.userId !== null &&
          m.userId !== userId &&
          m.deletedAt === null &&
          rooms.some(({ roomId, after }) => m.roomId === roomId && (after ? m.id > after : true)),
      )
      if (waiting.length === 0) return null
      // Ids sort the way the transcript does, which is the whole reason the
      // store hands them out rather than letting anybody invent one.
      return waiting.reduce((newest, m) => (m.id > newest.id ? m : newest)).userId
    },

    toggleReaction: async (roomId, messageId, userId, emoji) => {
      const found = messages.find((m) => m.id === messageId && m.roomId === roomId)
      if (!found) return null

      const had = (found.reactions[emoji] ?? []).includes(userId)

      // Off every emoji first, so choosing a second one moves the reaction
      // rather than adding to it. Also how "take it back" is expressed: the
      // emoji that was already chosen simply is not put back on.
      for (const [key, who] of Object.entries(found.reactions)) {
        const left = who.filter((id) => id !== userId)
        if (left.length === 0) delete found.reactions[key]
        else found.reactions[key] = left
      }

      if (had) return 'removed'
      found.reactions[emoji] = [...(found.reactions[emoji] ?? []), userId]
      return 'added'
    },

    editMessage: async (roomId, messageId, userId, body) => {
      const found = messages.find(
        (m) =>
          m.id === messageId &&
          m.roomId === roomId &&
          m.userId === userId &&
          m.deletedAt === null &&
          m.kind === 'text',
      )
      if (!found) return null
      found.body = body
      found.editedAt = new Date().toISOString()
      return structuredClone(found)
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
