import { aiClient, aiServiceConfigured } from '@/server/services/ai-service'

/**
 * The client for `medaily-ai`, the service that answers the capture box.
 *
 * Two calls: ask, and throw the thread away. Nothing is read back — each
 * opening of the panel gets a thread of its own, so what is on screen is the
 * whole of it.
 *
 * The asking is streamed, so its caller is a route handler rather than a
 * server action: an action returns a value, and a stream is not one.
 *
 * Unset, `assistantEnabled` is false and the destination is not offered at all.
 */
const TIMEOUT_MS = { ask: 90_000, clear: 10_000 } as const

export function assistantEnabled(): boolean {
  return aiServiceConfigured()
}

const client = () => aiClient('assistant')

/*
 * What the router decided used to be typed here, back when this file read the
 * answer. The panel reads the stream now and the agent sends it the one field
 * worth showing, so there is nothing left on this side to give a shape to:
 *
 * export type AssistantDecision = { intent: string; period: string; reason: string }
 */

/**
 * A question, answered as it is worked out.
 *
 * `/live` is the agent's panel-shaped stream: the step now running, how the
 * question was read, and the answer. Its sibling `/stream` reports every node
 * patch instead, which is what to reach for when a nine-second run needs
 * explaining rather than showing.
 *
 * The response is handed back unread. Whoever called this owns the body.
 */
export async function streamMessage(input: {
  threadId: string
  userId: string
  message: string
  timezone?: string
}): Promise<Response> {
  return client().open('/api/chat/live', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    timeoutMs: TIMEOUT_MS.ask,
  })
}

/** The end of a conversation: on the way out of the panel, or on "start over". */
export async function deleteThread(threadId: string): Promise<void> {
  await client().request(`/api/threads/${encodeURIComponent(threadId)}`, {
    method: 'DELETE',
    timeoutMs: TIMEOUT_MS.clear,
  })
}
