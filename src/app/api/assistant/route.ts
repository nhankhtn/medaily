import { z } from 'zod'
import { CAPTURE_OPENING, captureThreadId } from '@/lib/capture/thread'
import { log } from '@/lib/log'
import { createLimit } from '@/lib/rate-limit'
import { assistantEnabled, streamMessage } from '@/server/services/assistant'
import { getSettings } from '@/server/services/settings'

/**
 * The capture box's assistant, streamed.
 *
 * A route handler rather than a server action, because an action returns one
 * value and this returns a run: the agent reports its progress as it goes, and
 * the panel says what is happening instead of spinning for nine seconds.
 *
 * What this handler owns is what only it can know: who is asking, which thread
 * that person's opening maps to, and how often they may ask. The shape of the
 * stream is not its business — `medaily-ai` sends the panel's events
 * ready to use (`step`, `reason`, `file`, `delta`, `answer`), and the body is
 * passed through untouched.
 *
 * The shared secret stops here, as it does in the action next door.
 *
 * A conversation, so a little tighter than a form: eight messages a minute.
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

  /*
   * Handed straight on. Cancelling this response cancels the read of the
   * agent's, which hangs up on it — so closing the panel mid-answer stops the
   * run being listened to rather than leaving a stream nobody reads.
   */
  return new Response(upstream.body, {
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

/*
 * What used to be here: this handler read the agent's node-by-node stream and
 * boiled it down to the three events the panel uses. That work moved to
 * `medaily-ai`, to `POST /api/chat/live` — the branch a run takes decides which
 * step is running next, and the side holding the decision is the one that can
 * say so without guessing.
 *
 * Kept because it is the fallback if that endpoint ever has to go away: point
 * `streamMessage` back at `/api/chat/stream` and restore this.
 *
 * import { readEvents, sseEvent } from '@/lib/sse'
 *
 * type NodeEvent = {
 *   node?: string
 *   patch?: { answer?: string; decision?: { intent?: string; reason?: string } }
 * }
 *
 * function after(node: string, intent: string | undefined): string | null {
 *   if (node === 'route') return intent === 'smalltalk' ? 'respond' : 'load'
 *   if (node === 'load') return 'respond'
 *   return null
 * }
 *
 * const body = upstream.body
 * const encoder = new TextEncoder()
 * let live = true
 *
 * const stream = new ReadableStream<Uint8Array>({
 *   async start(controller) {
 *     const send = (event: string, data: unknown) => {
 *       if (!live) return
 *       try {
 *         controller.enqueue(encoder.encode(sseEvent(event, data)))
 *       } catch {
 *         live = false
 *       }
 *     }
 *
 *     let intent: string | undefined
 *
 *     try {
 *       for await (const event of readEvents(body)) {
 *         if (!live) break
 *         if (event.event === 'error') {
 *           send('failed', {})
 *           continue
 *         }
 *         if (event.event !== 'node') continue
 *
 *         const { node, patch }: NodeEvent = JSON.parse(event.data)
 *         if (!node) continue
 *
 *         if (patch?.decision) {
 *           intent = patch.decision.intent
 *           if (patch.decision.reason) send('reason', { reason: patch.decision.reason })
 *         }
 *
 *         const running = after(node, intent)
 *         if (running) send('step', { node: running })
 *         if (patch?.answer) send('answer', { answer: patch.answer })
 *       }
 *     } catch (error) {
 *       await log.error('assistant', 'the run broke off', error)
 *       send('failed', {})
 *     } finally {
 *       if (live) {
 *         live = false
 *         controller.close()
 *       }
 *     }
 *   },
 *   cancel() {
 *     live = false
 *   },
 * })
 *
 * return new Response(stream, { headers: ... })
 */
