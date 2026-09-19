/**
 * Which conversation a person is in.
 *
 * One per opening of the panel, and the id is two halves: the person, named by
 * the server, and the opening, named by the browser. Nothing is stored and
 * nothing has to be cleared before the panel is usable — an id nobody has
 * written to is already an empty conversation.
 *
 * The person's half never comes from the browser, so a message cannot be sent
 * into someone else's thread by asking for one. The opening's half does, and
 * ends up in a URL path and a database key, so it is checked rather than
 * trusted.
 */
export const CAPTURE_OPENING = /^[0-9a-z-]{8,64}$/

export function captureThreadId(userId: string, opening: string): string {
  return `capture:${userId}:${opening}`
}
