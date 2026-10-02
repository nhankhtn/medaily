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
  /**
   * A group's picture, as a delivery URL rather than a Cloudinary id — the
   * same shape `users.image_url` holds, so every screen that draws a face
   * draws this one the same way. Null on a direct room, which wears the face
   * of the person you are talking to.
   */
  avatarUrl: string | null
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
  /** A sticker keeps its id in `body` — a message is one thing or the other. */
  kind: MessageKind
  /** Null once the author erased their account; the words stay. */
  userId: string | null
  body: string
  createdAt: string
  deletedAt: string | null
  /**
   * When the words last changed, or null if they never did.
   *
   * Shown rather than hidden: a sentence that quietly became a different
   * sentence is worse than one that says it was rewritten, and the person
   * being answered deserves to know which one they are answering.
   */
  editedAt: string | null
  /** Emoji to user ids. Empty rather than absent, so counting needs no check. */
  reactions: Record<string, string[]>
  /**
   * Resolved on read, never stored: a copy would not follow a recall, and
   * bodies are sealed at rest. Null when nothing was answered, or when the
   * answer outlived what it answered.
   */
  replyTo: ReplyPreview | null
}

/** Just enough of a message to draw a quote above the answer to it. */
export type ReplyPreview = {
  id: string
  userId: string | null
  kind: MessageKind
  /** Trimmed, and empty once the quoted message was recalled. */
  body: string
  deleted: boolean
}

/** Past this a quote stops being a glance. */
export const PREVIEW_CHARS = 120

/** The quoted body as a reader sees it: one line, bounded. */
export function previewBody(body: string): string {
  const flat = body.replace(/\s+/g, ' ').trim()
  return flat.length > PREVIEW_CHARS ? `${flat.slice(0, PREVIEW_CHARS - 1)}…` : flat
}

/** What a resolved quote looks like, from the message it points at. */
export function previewOf(message: ChatMessage): ReplyPreview {
  return {
    id: message.id,
    userId: message.userId,
    kind: message.kind,
    body: message.deletedAt ? '' : previewBody(message.body),
    deleted: message.deletedAt !== null,
  }
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
