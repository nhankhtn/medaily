import { log } from '@/lib/log'
import type { ChatStore } from '@/lib/chat/store'
import type { MessageKind } from '@/lib/chat/types'
import { PATHS } from '@/lib/paths'
import { findUsersByIds } from '@/server/repositories/auth'
import { notify } from './push'

/**
 * Telling a room that somebody said something.
 *
 * Separate from the action so the action reads as "save, then tell": who is in
 * the room, who sent it, and what a sticker is called are all questions about
 * notifying, not about sending.
 *
 * Nothing here throws. It is called without being awaited, from the path that
 * has already saved the message, and an unhandled rejection there would be a
 * crash for something nobody is waiting on.
 */
export async function notifyRoom({
  roomId,
  senderId,
  title,
  kind,
  body,
  store,
}: {
  roomId: string
  senderId: string
  title: string | null
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

/**
 * The words that land on a lock screen.
 *
 * Pure and exported so it can be asserted: it is read by somebody who has not
 * opened the app and cannot ask what it meant, and one branch of it would
 * otherwise show a sticker's internal id as though it were a sentence.
 */
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
  // A sticker's body is an id. Showing it would put `coffee` on a lock screen
  // as though it were what was said.
  const said = kind === 'sticker' ? '🙂' : body.replace(/\s+/g, ' ').trim()
  const line = said.length > PREVIEW_CHARS ? `${said.slice(0, PREVIEW_CHARS - 1)}…` : said

  return {
    // The room's name when it has one, the sender's when it does not — a
    // direct conversation has no title, and the app's name over somebody's
    // words says nothing the icon did not.
    title: title ?? (who || 'medaily'),
    // Named only in a room with its own title; in a direct conversation the
    // title is already the person.
    body: title && who ? `${who}: ${line}` : line,
  }
}

