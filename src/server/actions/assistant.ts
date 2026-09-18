'use server'

import { z } from 'zod'
import { captureThreadId } from '@/lib/capture/thread'
import { log } from '@/lib/log'
import { createLimit } from '@/lib/rate-limit'
import {
  assistantEnabled,
  deleteThread,
  readThread,
  sendMessage,
  type AssistantDecision,
  type AssistantTurn,
} from '@/server/services/assistant'
import { getSettings } from '@/server/services/settings'

/**
 * The capture box's assistant, answered by `medaily-ai`.
 *
 * Everything the panel needs goes through here, because the shared secret to
 * that service must not reach a browser. The panel holds no conversation of its
 * own: it asks, and it reads the thread back.
 *
 * A conversation, so a little tighter than a form: eight messages a minute.
 */
const questions = createLimit({ capacity: 8, refillMs: 60 * 1000 })

export type AssistantResult =
  | { ok: true; answer: string; decision: AssistantDecision | null }
  | { ok: false; error: 'disabled' | 'invalid_input' | 'rate_limited' | 'failed' }

export async function askAssistant(input: unknown): Promise<AssistantResult> {
  if (!assistantEnabled()) return { ok: false, error: 'disabled' }

  const parsed = z.object({ message: z.string().trim().min(2).max(1000) }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }

  const settings = await getSettings()
  if (!questions.take(settings.userId).allowed) return { ok: false, error: 'rate_limited' }

  try {
    /*
     * No history is sent. The service has it — that is the whole reason this
     * destination exists next to the one that replays its own transcript.
     */
    const result = await sendMessage({
      threadId: captureThreadId(settings.userId),
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

export type AssistantHistory = { ok: true; turns: AssistantTurn[] } | { ok: false }

/** What the panel shows when it opens, read from Postgres rather than memory. */
export async function assistantHistory(): Promise<AssistantHistory> {
  if (!assistantEnabled()) return { ok: false }

  const settings = await getSettings()
  return { ok: true, turns: await readThread(captureThreadId(settings.userId)) }
}

export async function resetAssistant(): Promise<{ ok: boolean }> {
  if (!assistantEnabled()) return { ok: false }

  const settings = await getSettings()
  try {
    await deleteThread(captureThreadId(settings.userId))
    return { ok: true }
  } catch (error) {
    await log.error('assistant', 'could not clear the thread', error)
    return { ok: false }
  }
}
