import { env } from '@/lib/env'
import { serviceClient } from '@/server/service-client'

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
 * Server-side only. `AI_SERVICE_TOKEN` is a shared secret between the two
 * deploys and must never reach a browser, so every call goes out from a server
 * action rather than from the panel that shows the answer.
 *
 * Unset, `assistantEnabled` is false and the destination is not offered at all.
 */
const TIMEOUT_MS = { ask: 90_000, clear: 10_000 } as const

export function assistantEnabled(): boolean {
  return Boolean(env.AI_SERVICE_URL && env.AI_SERVICE_TOKEN)
}

/** Built per call: the configuration may be absent, and then there is no client. */
function client() {
  return serviceClient({
    name: 'assistant',
    baseUrl: env.AI_SERVICE_URL as string,
    token: env.AI_SERVICE_TOKEN as string,
  })
}

/**
 * What the router decided. Shown, not logged: a question read the wrong way
 * should be visible to the person who asked it.
 */
export type AssistantDecision = { intent: string; period: string; reason: string }

/**
 * A question, answered node by node.
 *
 * The agent reports each step of a run as it finishes it, and a run is several
 * seconds long — so the panel can say what is happening instead of spinning,
 * and can show how the question was read before the answer exists.
 *
 * The response is handed back unread. Whoever called this owns the body.
 */
export async function streamMessage(input: {
  threadId: string
  userId: string
  message: string
  timezone?: string
}): Promise<Response> {
  return client().open('/api/chat/stream', {
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
