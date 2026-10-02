import { z } from 'zod'
import { CAPTURE_OPENING, captureThreadId } from '@/lib/capture/thread'
import { log } from '@/lib/log'
import { createLimit } from '@/lib/rate-limit'
import { assistantEnabled, streamMessage } from '@/server/services/assistant'
import { getSettings } from '@/server/services/settings'

/**
 * The capture box's assistant, streamed.
 *
 * A route rather than an action because this returns a run, not a value:
 * `medaily-ai` emits the panel's events ready to use and the body is passed
 * through untouched.
 */
const questions = createLimit({ capacity: 8, refillMs: 60 * 1000 })

const ask = z.object({
  message: z.string().trim().min(2).max(1000),
  opening: z.string().regex(CAPTURE_OPENING),
})

export async function POST(request: Request) {
  if (!assistantEnabled()) return Response.json({ error: 'disabled' }, { status: 503 })

  const parsed = ask.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'invalid_input' }, { status: 400 })

  const settings = await getSettings()
  if (!questions.take(settings.userId).allowed) {
    return Response.json({ error: 'rate_limited' }, { status: 429 })
  }

  let upstream: Response
  try {
    upstream = await streamMessage({
      threadId: captureThreadId(settings.userId, parsed.data.opening),
      userId: settings.userId,
      message: parsed.data.message,
      timezone: settings.timezone,
    })
  } catch (error) {
    await log.error('assistant', 'could not start the run', error)
    return Response.json({ error: 'failed' }, { status: 502 })
  }

  if (!upstream.body) return Response.json({ error: 'failed' }, { status: 502 })

  // Cancelling this response cancels the read of the agent's, so closing the
  // panel mid-answer hangs up on the run.
  return new Response(upstream.body, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      // Three ways a proxy or a browser would buffer this into one delivery at
      // the end: gzip (3.8s to first event, against 0.7s), Chrome sniffing the
      // first kilobyte, and nginx holding the whole response.
      'cache-control': 'no-store, no-transform',
      'x-content-type-options': 'nosniff',
      'x-accel-buffering': 'no',
    },
  })
}
