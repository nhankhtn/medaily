'use server'

import { z } from 'zod'
import { CAPTURE_OPENING, captureThreadId } from '@/lib/capture/thread'
import { log } from '@/lib/log'
import { assistantEnabled, deleteThread } from '@/server/services/assistant'
import { getSettings } from '@/server/services/settings'

/**
 * Ending one opening's conversation: on the way out of the panel, and on
 * "start over".
 *
 * Asking is not here — an answer arrives a node at a time, and an action
 * returns a value rather than a stream, so the question goes to the route
 * handler at `/api/assistant`. Both add the person's half of the thread id
 * server-side, where a browser cannot reach it.
 */
export async function resetAssistant(input: unknown): Promise<{ ok: boolean }> {
  if (!assistantEnabled()) return { ok: false }

  const parsed = z.string().regex(CAPTURE_OPENING).safeParse(input)
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
