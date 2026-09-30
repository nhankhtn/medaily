import { env } from '@/lib/env'
import { mongoChatStore } from './mongo-store'
import { NO_CHAT, type ChatStore } from './store'

/**
 * The one line that picks a store.
 *
 * Swapping MongoDB for Postgres is a second file implementing `ChatStore` and
 * a change here. No service moves and no call site knows the difference — the
 * activity trail next door is the same shape.
 *
 * Absent `MONGODB_URI` the feature is off: nothing connects, no room can be
 * made, and the nav does not offer it. Unlike the trail, chat cannot half
 * work — a conversation you can open but not write to is worse than none.
 *
 * A function rather than a constant, so a test can call it after changing the
 * environment and a serverless instance cannot cache a decision made before
 * its configuration arrived.
 */
export function pickChatStore(): ChatStore {
  const uri = env.MONGODB_URI?.trim()
  return uri ? mongoChatStore(uri) : NO_CHAT
}

/** Whether chat is offered at all — for the nav and for the privacy notice. */
export function chatEnabled(): boolean {
  return pickChatStore().id !== NO_CHAT.id
}
