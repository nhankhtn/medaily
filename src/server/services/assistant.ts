import { env } from '@/lib/env'
import { log } from '@/lib/log'
import { serviceClient, ServiceError } from '@/server/service-client'

/**
 * The client for `medaily-ai`, the service that answers with a memory.
 *
 * Server-side only. `AI_SERVICE_TOKEN` is a shared secret between the two
 * deploys and must never reach a browser, so every call goes out from a server
 * action rather than from the panel that shows the answer.
 *
 * Unset, `assistantEnabled` is false and the destination is not offered at all.
 */
const TIMEOUT_MS = { ask: 90_000, read: 10_000 } as const

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

export type AssistantTurn = { role: 'user' | 'model'; text: string }

/**
 * What the router decided. Shown, not logged: a question read the wrong way
 * should be visible to the person who asked it.
 */
export type AssistantDecision = { intent: string; period: string; reason: string }

export type AssistantAnswer = { answer: string; decision: AssistantDecision | null }

export async function sendMessage(input: {
  threadId: string
  userId: string
  message: string
  timezone?: string
}): Promise<AssistantAnswer> {
  const body = await client().request<{ answer?: string; decision?: AssistantDecision | null }>(
    '/api/chat',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      timeoutMs: TIMEOUT_MS.ask,
    },
  )

  if (!body.answer) throw new Error('assistant returned no answer')
  return { answer: body.answer, decision: body.decision ?? null }
}

/**
 * The conversation as the service has it. This is the whole point of the thing:
 * the panel renders what Postgres remembers, not what this browser happens to
 * still hold, so the same conversation opens on a phone.
 *
 * A thread nobody has written to yet is a 404, which is not a failure — it is
 * the first visit.
 */
export async function readThread(threadId: string): Promise<AssistantTurn[]> {
  try {
    const body = await client().request<{ messages?: AssistantTurn[] }>(
      `/api/threads/${encodeURIComponent(threadId)}`,
      { method: 'GET', timeoutMs: TIMEOUT_MS.read },
    )
    return body.messages ?? []
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) return []
    await log.error('assistant', 'could not read the thread', error)
    return []
  }
}

/** Starting over. The id is reused, so the next message opens it again, empty. */
export async function deleteThread(threadId: string): Promise<void> {
  await client().request(`/api/threads/${encodeURIComponent(threadId)}`, {
    method: 'DELETE',
    timeoutMs: TIMEOUT_MS.read,
  })
}
