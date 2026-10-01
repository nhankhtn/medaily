export const ROOM_KINDS = ['direct', 'group', 'challenge'] as const
export type RoomKind = (typeof ROOM_KINDS)[number]

export const MEMBER_ROLES = ['owner', 'member'] as const
export type MemberRole = (typeof MEMBER_ROLES)[number]

export type ChatRoom = {
  id: string
  /**
   * Fixed when the room is made, never derived from how many people are in it.
   * A group of three that two people leave is still a group; letting it become
   * a direct room would hand it rules it was never created under, and would
   * make the direct-room uniqueness impossible to enforce at insert time.
   */
  kind: RoomKind
  title: string | null
  /** Null once the person who made the room has erased their account. */
  createdBy: string | null
  /**
   * What the realtime doorbell is addressed by — never the room id, so that
   * removing somebody can take their ability to watch the room with them.
   */
  doorbellKey: string
  /** Set only on a direct room: the two user ids, sorted and joined. */
  directKey: string | null
  lastMessageAt: string | null
  createdAt: string
}

export type ChatMember = {
  roomId: string
  userId: string
  role: MemberRole
  joinedAt: string
  leftAt: string | null
  /** Where this person had read up to, as a message id rather than a time. */
  lastReadMessageId: string | null
}

export type MessageKind = 'text' | 'sticker'

export type ChatMessage = {
  id: string
  roomId: string
  /**
   * What `body` holds. A sticker keeps its id there rather than in a field of
   * its own: one column, and a message is one thing or the other, never both.
   */
  kind: MessageKind
  /**
   * Null once the author erased their account. The words stay — that is the
   * choice this app made — but nothing points back at a person any more, and
   * every screen that renders a message has to survive it.
   */
  userId: string | null
  body: string
  createdAt: string
  deletedAt: string | null
  /**
   * Who reacted with what, emoji to user ids.
   *
   * Kept on the message rather than beside it: a reaction is never read apart
   * from the message it is on, and both the vocabulary and the room's size
   * bound how large this can get. Empty rather than absent, so nothing has to
   * check before counting.
   */
  reactions: Record<string, string[]>
}

export type ChatInvite = {
  code: string
  roomId: string
  createdBy: string | null
  /** Lowercased, and never checked against the user table — see `createInvite`. */
  email: string | null
  expiresAt: string
  maxUses: number
  usedCount: number
  revokedAt: string | null
  createdAt: string
}

/**
 * One page of a conversation.
 *
 * `more` exists for the forward direction and callers must honour it. A client
 * that has been away for an hour and treats one capped page as the whole of
 * what it missed moves its cursor past messages it never showed, and nothing
 * ever goes back for them — a hole in the middle of a conversation that no
 * amount of scrolling repairs.
 */
export type MessagePage = {
  items: ChatMessage[]
  cursor: string | null
  more: boolean
}

/** The two user ids in a fixed order, so one pair can only ever build one key. */
export function directKeyOf(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

/** How many messages a screen asks for at a time. */
export const MESSAGE_PAGE = 50

/** A sender, as the transcript names them. Absent means they erased their account. */
export type Speaker = {
  id: string
  name: string
  imageUrl: string | null
  /**
   * The name Firestore knows this person by.
   *
   * The typing indicator is the only thing that reads it: Firestore rules tie
   * a write to `request.auth.uid`, so a claim of "I am typing" can only be made
   * in your own name. Matching that back to a member needs the uid here.
   *
   * Their Firebase uid when Google sign-in has minted one, otherwise their id,
   * which is what the server mints a custom token under. Null only for someone
   * who erased their account.
   */
  firebaseUid: string | null
}
