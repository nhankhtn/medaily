/**
 * Asking the transcript to go somewhere.
 *
 * A window event, like `PUSH_CHANGED` next door, and for the same reason: the
 * two halves of this are siblings under a server component, so there is no
 * parent to hold the state and no way to pass a callback down. The alternative
 * was moving the search into the transcript, which would put its button
 * somewhere other than the room's own header — a worse answer to a wiring
 * problem.
 *
 * One event, one payload, one listener. Anything more and this stops being a
 * wire and starts being a message bus.
 */
export const CHAT_JUMP = 'medaily:chat-jump'

export function askToJump(messageId: string): void {
  window.dispatchEvent(new CustomEvent(CHAT_JUMP, { detail: messageId }))
}

/** The id a jump asked for, or null if the event carried something else. */
export function jumpTarget(event: Event): string | null {
  const detail = (event as CustomEvent<unknown>).detail
  return typeof detail === 'string' && detail ? detail : null
}
