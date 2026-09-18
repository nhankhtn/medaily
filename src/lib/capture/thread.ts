/**
 * Which conversation a person is in.
 *
 * Named after them rather than stored: the agent service keys its checkpoints
 * by this string, so deriving it means the conversation is already waiting on a
 * new machine, a new browser and a fresh install — with no column to migrate
 * and nothing for a browser to lose.
 *
 * The cost is that there is exactly one, and it never ends on its own. Starting
 * over is deliberate: the thread is deleted, and the next message opens the
 * same id again, empty.
 */
export function captureThreadId(userId: string): string {
  return `capture:${userId}`
}
