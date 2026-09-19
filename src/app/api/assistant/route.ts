import { z } from 'zod'
import { CAPTURE_OPENING, captureThreadId } from '@/lib/capture/thread'
import { log } from '@/lib/log'
import { createLimit } from '@/lib/rate-limit'
import { readEvents, sseEvent } from '@/lib/sse'
import { assistantEnabled, streamMessage } from '@/server/services/assistant'
import { getSettings } from '@/server/services/settings'

/**
 * The capture box's assistant, streamed.
 *
 * A route handler rather than a server action, because an action returns one
 * value and this returns a run: the agent reports each node as it finishes,
 * and the panel says what is happening instead of spinning for nine seconds.
 *
 * The shared secret to the agent service stops here, as it does in the action
 * next door. What reaches the browser is the three things it has any use for —
 * which step is running, how the question was read, and the answer.
 *
 * The agent reports a node when it *finishes* one, so the step sent on is the
 * node that must be running now. Which one that is depends on the route the
 * run took, and this is the side that can see it.
 *
 * A conversation, so a little tighter than a form: eight messages a minute.
 */
const questions = createLimit({ capacity: 8, refillMs: 60 * 1000 })

const ask = z.object({
  message: z.string().trim().min(2).max(1000),
  opening: z.string().regex(CAPTURE_OPENING),
})

type NodeEvent = {
  node?: string
  patch?: { answer?: string; decision?: { intent?: string; reason?: string } }
}

/** A greeting skips the database, so after routing it is already answering. */
function after(node: string, intent: string | undefined): string | null {
  if (node === 'route') return intent === 'smalltalk' ? 'respond' : 'load'
  if (node === 'load') return 'respond'
  return null
}

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

  const body = upstream.body
  if (!body) return Response.json({ error: 'failed' }, { status: 502 })

  const encoder = new TextEncoder()
  /*
   * A run outlives the person watching it: closing the panel mid-answer
   * cancels this stream while the agent is still talking. Writing into a
   * cancelled controller throws, so every write is gated and the loop stops
   * on the next event — which ends the read, which hangs up on the agent.
   */
  let live = true

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (!live) return
        try {
          controller.enqueue(encoder.encode(sseEvent(event, data)))
        } catch {
          live = false
        }
      }

      let intent: string | undefined

      try {
        for await (const event of readEvents(body)) {
          if (!live) break
          if (event.event === 'error') {
            send('failed', {})
            continue
          }
          if (event.event !== 'node') continue

          const { node, patch }: NodeEvent = JSON.parse(event.data)
          if (!node) continue

          if (patch?.decision) {
            intent = patch.decision.intent
            if (patch.decision.reason) send('reason', { reason: patch.decision.reason })
          }

          const running = after(node, intent)
          if (running) send('step', { node: running })
          if (patch?.answer) send('answer', { answer: patch.answer })
        }
      } catch (error) {
        await log.error('assistant', 'the run broke off', error)
        send('failed', {})
      } finally {
        if (live) {
          live = false
          controller.close()
        }
      }
    },
    cancel() {
      live = false
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      /*
       * `no-transform` is the part that matters: gzip collects a buffer before
       * it emits anything, and these events are a few dozen bytes each, so a
       * compressed stream arrives all at once when the run ends. Measured at
       * 3.8s to the first event with gzip against 0.7s without.
       */
      'cache-control': 'no-store, no-transform',
      // And Chrome holds the first kilobyte back to sniff the type.
      'x-content-type-options': 'nosniff',
      // Nginx buffers a response until it is whole unless told otherwise,
      // which would deliver the whole point of this at the very end.
      'x-accel-buffering': 'no',
    },
  })
}
