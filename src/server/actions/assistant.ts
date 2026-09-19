'use server'

import { z } from 'zod'
import { captureThreadId, CAPTURE_OPENING } from '@/lib/capture/thread'
import { log } from '@/lib/log'
import { createLimit } from '@/lib/rate-limit'
import {
  assistantEnabled,
  deleteThread,
  sendMessage,
  type AssistantDecision,
} from '@/server/services/assistant'
import { getSettings } from '@/server/services/settings'

/**
 * The capture box's assistant, answered by `medaily-ai`.
 *
 * Everything the panel needs goes through here, because the shared secret to
 * that service must not reach a browser. The panel names its own opening; the
 * person's half of the thread id is added here, where a browser cannot reach
 * it.
 *
 * A conversation, so a little tighter than a form: eight messages a minute.
 */
const questions = createLimit({ capacity: 8, refillMs: 60 * 1000 })

const opening = z.string().regex(CAPTURE_OPENING)

export type AssistantResult =
  | { ok: true; answer: string; decision: AssistantDecision | null }
  | { ok: false; error: 'disabled' | 'invalid_input' | 'rate_limited' | 'failed' }

export async function askAssistant(input: unknown): Promise<AssistantResult> {
  if (!assistantEnabled()) return { ok: false, error: 'disabled' }

  const parsed = z
    .object({ message: z.string().trim().min(2).max(1000), opening })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }

  const settings = await getSettings()
  if (!questions.take(settings.userId).allowed) return { ok: false, error: 'rate_limited' }

  try {
    /*
     * No history is sent. The service has it — that is the whole reason this
     * destination exists next to the one that replays its own transcript.
     */
    const result = await sendMessage({
      threadId: captureThreadId(settings.userId, parsed.data.opening),
      userId: settings.userId,
      message: parsed.data.message,
      timezone: settings.timezone,
    })
    return { ok: true, ...result }
  } catch (error) {
    await log.error('assistant', 'could not answer', error)
    return { ok: false, error: 'failed' }
  }
}

/** Ends one opening's conversation: on the way out, and on "start over". */
export async function resetAssistant(input: unknown): Promise<{ ok: boolean }> {
  if (!assistantEnabled()) return { ok: false }

  const parsed = opening.safeParse(input)
  if (!parsed.success) return { ok: false }

  const settings = await getSettings()
  try {
    await deleteThread(captureThreadId(settings.userId, parsed.data))
    return { ok: true }
  } catch (error) {
    await log.error('assistant', 'could not clear the thread', error)
    return { ok: false }
  }
}
