import { ObjectId, type Collection, type Document } from 'mongodb'
import { readyCollection } from '@/lib/mongo/client'
import type { ChatStore } from './store'
import type { ChatInvite, ChatMember, ChatMessage, ChatRoom, MemberRole, RoomKind } from './types'

const ROOMS = 'chat_rooms'
const MEMBERS = 'chat_members'
const MESSAGES = 'chat_messages'
const INVITES = 'chat_invites'

/** Mongo's code for "a unique index said no". */
const DUPLICATE_KEY = 11000

type RoomDoc = {
  _id: string
  kind: RoomKind
  title: string | null
  createdBy: string | null
  doorbellKey: string
  directKey?: string
  lastMessageAt?: Date | null
  createdAt: Date
}

type MemberDoc = {
  _id: string
  roomId: string
  userId: string
  role: MemberRole
  joinedAt: Date
  leftAt?: Date | null
  lastReadMessageId?: string | null
}

type MessageDoc = {
  _id: ObjectId
  roomId: string
  userId: string | null
  body: string
  createdAt: Date
  clientId: string
  deletedAt?: Date | null
}

type InviteDoc = {
  _id: string
  roomId: string
  createdBy: string | null
  email?: string | null
  expiresAt: Date
  maxUses: number
  usedCount: number
  revokedAt?: Date | null
  createdAt: Date
}

/**
 * The MongoDB adapter. Everything Mongo-shaped stops here: the driver,
 * `ObjectId`, the unique indexes that make the races safe, and the fact that
 * there are four collections at all.
 *
 * **No transactions.** Mongo has them but they need a replica set, and the
 * mongod the integration tests run against is a standalone — code that works
 * on Atlas and fails in CI is the worst kind. Every write here is idempotent
 * by key instead, so a retry is always safe and a half-finished sequence
 * leaves something harmless rather than something wrong.
 */
export function mongoChatStore(uri: string): ChatStore {
  const seat = (roomId: string, userId: string) => `${roomId}:${userId}`

  return {
    id: 'mongo',

    createRoom: async (room) => {
      const rooms = await roomsIn(uri)
      const doc: RoomDoc = {
        _id: room.id,
        kind: room.kind,
        title: room.title,
        createdBy: room.createdBy,
        doorbellKey: room.doorbellKey,
        // Omitted rather than null for a group room: the partial index that
        // makes direct rooms unique keys on the field being *there*.
        ...(room.directKey ? { directKey: room.directKey } : {}),
        lastMessageAt: null,
        createdAt: new Date(),
      }
      await rooms.insertOne(doc)
      return asRoom(doc)!
    },

    findRoom: async (roomId) => asRoom(await (await roomsIn(uri)).findOne({ _id: roomId })),

    findRoomByDirectKey: async (directKey) =>
      asRoom(await (await roomsIn(uri)).findOne({ directKey })),

    listRoomsFor: async (userId) => {
      const seats = await (
        await membersIn(uri)
      )
        .find({ userId, leftAt: null }, { projection: { roomId: 1 } })
        .toArray()
      if (seats.length === 0) return []

      const rows = await (
        await roomsIn(uri)
      )
        .find({ _id: { $in: seats.map((s) => s.roomId) } })
        .sort({ lastMessageAt: -1 })
        .toArray()
      return rows.map((row) => asRoom(row)!)
    },

    rotateDoorbell: async (roomId) => {
      const doorbellKey = crypto.randomUUID()
      const updated = await (
        await roomsIn(uri)
      ).updateOne({ _id: roomId }, { $set: { doorbellKey } })
      return updated.matchedCount > 0 ? doorbellKey : ''
    },

    touchRoom: async (roomId, at) => {
      await (await roomsIn(uri)).updateOne({ _id: roomId }, { $set: { lastMessageAt: at } })
    },

    deleteRoom: async (roomId) => {
      await (await roomsIn(uri)).deleteOne({ _id: roomId })
      await (await membersIn(uri)).deleteMany({ roomId })
    },

    addMember: async (member) => {
      await (
        await membersIn(uri)
      ).updateOne(
        { _id: seat(member.roomId, member.userId) },
        {
          $setOnInsert: {
            roomId: member.roomId,
            userId: member.userId,
            role: member.role,
            joinedAt: new Date(member.joinedAt),
            leftAt: null,
            lastReadMessageId: null,
          },
        },
        { upsert: true },
      )
    },

    findMember: async (roomId, userId) =>
      asMember(await (await membersIn(uri)).findOne({ _id: seat(roomId, userId) })),

    listMembers: async (roomId) =>
      (await (await membersIn(uri)).find({ roomId }).toArray()).map((row) => asMember(row)!),

    removeMember: async (roomId, userId) => {
      await (
        await membersIn(uri)
      ).updateOne({ _id: seat(roomId, userId) }, { $set: { leftAt: new Date() } })
    },

    countMembers: async (roomId) => (await membersIn(uri)).countDocuments({ roomId, leftAt: null }),

    markRead: async (roomId, userId, messageId) => {
      await (
        await membersIn(uri)
      ).updateOne({ _id: seat(roomId, userId) }, { $set: { lastReadMessageId: messageId } })
    },

    appendMessage: async (message) => {
      const messages = await messagesIn(uri)
      const doc: MessageDoc = {
        _id: new ObjectId(),
        roomId: message.roomId,
        userId: message.userId,
        body: message.body,
        createdAt: new Date(),
        clientId: message.clientId,
        deletedAt: null,
      }

      try {
        await messages.insertOne(doc)
        return asMessage(doc)!
      } catch (error) {
        // A send whose reply never arrived, tried again. The unique index on
        // (roomId, clientId) is what makes the second attempt a read.
        if (!isDuplicateKey(error)) throw error
        const already = await messages.findOne({
          roomId: message.roomId,
          clientId: message.clientId,
        })
        if (!already) throw error
        return asMessage(already)!
      }
    },

    listBackward: async (roomId, { before, limit }) => {
      const rows = await (
        await messagesIn(uri)
      )
        .find({ roomId, ...(before ? { _id: { $lt: new ObjectId(before) } } : {}) })
        .sort({ _id: -1 })
        .limit(limit + 1)
        .toArray()
      return pageOf(rows, limit)
    },

    listForward: async (roomId, { after, limit }) => {
      const rows = await (
        await messagesIn(uri)
      )
        .find({ roomId, ...(after ? { _id: { $gt: new ObjectId(after) } } : {}) })
        .sort({ _id: 1 })
        .limit(limit + 1)
        .toArray()
      return pageOf(rows, limit)
    },

    softDeleteMessage: async (roomId, messageId, userId) => {
      if (!ObjectId.isValid(messageId)) return false
      const updated = await (
        await messagesIn(uri)
      ).updateOne(
        { _id: new ObjectId(messageId), roomId, userId, deletedAt: null },
        { $set: { deletedAt: new Date(), body: '' } },
      )
      return updated.matchedCount > 0
    },

    createInvite: async (invite) => {
      const doc: InviteDoc = {
        _id: invite.code,
        roomId: invite.roomId,
        createdBy: invite.createdBy,
        email: invite.email,
        expiresAt: new Date(invite.expiresAt),
        maxUses: invite.maxUses,
        usedCount: 0,
        revokedAt: null,
        createdAt: new Date(),
      }
      await (await invitesIn(uri)).insertOne(doc)
      return asInvite(doc)!
    },

    findInvite: async (code) => asInvite(await (await invitesIn(uri)).findOne({ _id: code })),

    useInvite: async (code, now) => {
      // One statement, so two people redeeming the last use of a link cannot
      // both win. A transaction would do the same thing and cost a replica set.
      const spent = await (
        await invitesIn(uri)
      ).updateOne(
        {
          _id: code,
          revokedAt: null,
          expiresAt: { $gt: now },
          $expr: { $lt: ['$usedCount', '$maxUses'] },
        },
        { $inc: { usedCount: 1 } },
      )
      return spent.matchedCount > 0
    },

    revokeInvite: async (code) => {
      await (await invitesIn(uri)).updateOne({ _id: code }, { $set: { revokedAt: new Date() } })
    },

    listInvites: async (roomId) =>
      (await (await invitesIn(uri)).find({ roomId }).toArray()).map((row) => asInvite(row)!),

    findInvitesForEmail: async (email, now) =>
      (
        await (
          await invitesIn(uri)
        )
          .find({
            email: email.toLowerCase(),
            revokedAt: null,
            expiresAt: { $gt: now },
            $expr: { $lt: ['$usedCount', '$maxUses'] },
          })
          .toArray()
      ).map((row) => asInvite(row)!),

    anonymiseMessagesOf: async (userId) => {
      // Set to null rather than removed: an absent field and a null one are
      // different things to a Mongo query, and the reading side asks for null.
      await (await messagesIn(uri)).updateMany({ userId }, { $set: { userId: null } })
    },

    removeMembershipsOf: async (userId) => {
      const members = await membersIn(uri)
      const seats = await members.find({ userId }, { projection: { roomId: 1 } }).toArray()
      await members.deleteMany({ userId })
      return [...new Set(seats.map((s) => s.roomId))]
    },

    deleteInvitesBy: async (userId) => {
      await (await invitesIn(uri)).deleteMany({ createdBy: userId })
    },

    deleteMessagesIn: async (roomId) => {
      await (await messagesIn(uri)).deleteMany({ roomId })
    },
  }
}

/**
 * The cursor is the message id itself, not an opaque token.
 *
 * The activity trail hides its `ObjectId` behind base64url because nothing
 * outside it ever names a row. A message id is already part of this API —
 * read receipts point at one, and so does recalling a message — so wrapping it
 * again would be ceremony that hides nothing.
 */
function pageOf(rows: MessageDoc[], limit: number) {
  const items = rows.slice(0, limit).map((row) => asMessage(row)!)
  return { items, cursor: items.at(-1)?.id ?? null, more: rows.length > limit }
}

function asRoom(doc: RoomDoc | null): ChatRoom | null {
  if (!doc) return null
  return {
    id: doc._id,
    kind: doc.kind,
    title: doc.title ?? null,
    createdBy: doc.createdBy ?? null,
    doorbellKey: doc.doorbellKey,
    directKey: doc.directKey ?? null,
    lastMessageAt: doc.lastMessageAt?.toISOString() ?? null,
    createdAt: doc.createdAt.toISOString(),
  }
}

function asMember(doc: MemberDoc | null): ChatMember | null {
  if (!doc) return null
  return {
    roomId: doc.roomId,
    userId: doc.userId,
    role: doc.role,
    joinedAt: doc.joinedAt.toISOString(),
    leftAt: doc.leftAt?.toISOString() ?? null,
    lastReadMessageId: doc.lastReadMessageId ?? null,
  }
}

function asMessage(doc: MessageDoc | null): ChatMessage | null {
  if (!doc) return null
  return {
    id: doc._id.toHexString(),
    roomId: doc.roomId,
    userId: doc.userId ?? null,
    body: doc.body,
    createdAt: doc.createdAt.toISOString(),
    deletedAt: doc.deletedAt?.toISOString() ?? null,
  }
}

function asInvite(doc: InviteDoc | null): ChatInvite | null {
  if (!doc) return null
  return {
    code: doc._id,
    roomId: doc.roomId,
    createdBy: doc.createdBy ?? null,
    email: doc.email ?? null,
    expiresAt: doc.expiresAt.toISOString(),
    maxUses: doc.maxUses,
    usedCount: doc.usedCount,
    revokedAt: doc.revokedAt?.toISOString() ?? null,
    createdAt: doc.createdAt.toISOString(),
  }
}

function isDuplicateKey(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'code' in error && error.code === DUPLICATE_KEY,
  )
}

function roomsIn(uri: string) {
  return readyCollection<RoomDoc>(uri, ROOMS, [
    // What makes two people tapping "message" at once end in one conversation.
    // Keyed on the field existing, so group rooms are not all "the same" room.
    {
      key: { directKey: 1 },
      name: 'direct_uniq',
      unique: true,
      partialFilterExpression: { directKey: { $exists: true } },
    },
    { key: { doorbellKey: 1 }, name: 'doorbell', unique: true },
  ])
}

function membersIn(uri: string) {
  return readyCollection<MemberDoc>(uri, MEMBERS, [
    { key: { userId: 1, leftAt: 1 }, name: 'user_rooms' },
    { key: { roomId: 1 }, name: 'room' },
  ])
}

function messagesIn(uri: string) {
  return readyCollection<MessageDoc>(uri, MESSAGES, [
    // Serves both directions: a btree is walkable either way.
    { key: { roomId: 1, _id: 1 }, name: 'room_seq' },
    { key: { roomId: 1, clientId: 1 }, name: 'room_client', unique: true },
    { key: { userId: 1 }, name: 'user' },
    // No TTL. A conversation that deletes itself after a while is a bug, and
    // the trail's TTL living in the same database is why that is worth saying.
  ])
}

function invitesIn(uri: string) {
  return readyCollection<InviteDoc>(uri, INVITES, [
    { key: { email: 1 }, name: 'email', sparse: true },
    { key: { roomId: 1 }, name: 'room' },
  ])
}
