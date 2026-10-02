import { log } from '@/lib/log'
import type { ChatStore } from '@/lib/chat/store'
import type { MessageKind } from '@/lib/chat/types'
import { PATHS } from '@/lib/paths'
import { findUsersByIds } from '@/server/repositories/auth'
import { notify } from './push'

/**
 * Never throws: called without being awaited from the path that already saved
 * the message.
 */
export async function notifyRoom({
  roomId,
  senderId,
  title,
  avatarUrl,
  kind,
  body,
  store,
}: {
  roomId: string
  senderId: string
  title: string | null
  /** The room's own picture, where somebody has given it one. */
  avatarUrl: string | null
  kind: MessageKind
  body: string
  store: ChatStore
}): Promise<void> {
  try {
    const members = await store.listMembers(roomId)
    const audience = members
      .filter((member) => member.leftAt === null && member.userId !== senderId)
      .map((member) => member.userId)
    if (audience.length === 0) return

    const [sender] = await findUsersByIds([senderId])
    const who = sender?.displayName ?? ''

    const shown = notificationFor({ kind, body, title, who: who || null })
    await notify(audience, {
      ...shown,
      icon: faceFor({ avatarUrl, senderImage: sender?.imageUrl ?? null }),
      url: PATHS.chatRoom(roomId),
      // One room is one line on the lock screen, however many messages arrive
      // while the phone is face down.
      tag: `chat:${roomId}`,
    })
  } catch (error) {
    await log.error('chat', 'could not notify a room', error)
  }
}

/** One line. Long enough to answer "do I need to look", short enough to read. */
const PREVIEW_CHARS = 140

/** Pure and exported so it can be asserted — read by somebody who cannot ask. */
export function notificationFor({
  kind,
  body,
  title,
  who,
}: {
  kind: MessageKind
  body: string
  /** The room's own name, where it has one. */
  title: string | null
  who: string | null
}): { title: string; body: string } {
  // A sticker's body is an id; `coffee` is not what anybody said.
  const said = kind === 'sticker' ? '🙂' : body.replace(/\s+/g, ' ').trim()
  const line = said.length > PREVIEW_CHARS ? `${said.slice(0, PREVIEW_CHARS - 1)}…` : said

  return {
    // A direct conversation has no title of its own, so the sender becomes it —
    // and is then not named twice.
    title: title ?? (who || 'medaily'),
    body: title && who ? `${who}: ${line}` : line,
  }
}

/**
 * The picture beside the words.
 *
 * The room's own where it has one; otherwise the sender's, because a direct
 * conversation has no face of its own and the person is the conversation. The
 * same order the room list and the room header already draw in, so the
 * notification looks like the thing it opens.
 *
 * `undefined` rather than an empty string when there is neither: the payload
 * leaves the key out, and the worker falls back to the app's icon.
 *
 * Only `https`. The value is written into a notification the browser then
 * fetches, so anything else is a request this app would be making on behalf of
 * a payload rather than a picture.
 */
export function faceFor({
  avatarUrl,
  senderImage,
}: {
  avatarUrl: string | null
  senderImage: string | null
}): string | undefined {
  for (const candidate of [avatarUrl, senderImage]) {
    if (candidate && candidate.startsWith('https://')) return candidate
  }
  return undefined
}
