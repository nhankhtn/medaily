'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { readSession } from '@/lib/auth/current-user'
import { clientKey } from '@/lib/client-ip'
import { createLimit } from '@/lib/rate-limit'
import { REQUEST_ID_HEADER } from '@/lib/request-id'
import { alertsEnabled, environmentName, sendSupportMessage } from '@/server/services/alerts'

const schema = z.object({
  body: z.string().trim().min(5).max(2000),
  /** Only asked for when nobody is signed in; a session already names them. */
  replyTo: z.string().trim().max(200).optional(),
  path: z.string().trim().max(200).optional(),
})

/**
 * Four an hour from one place. The gate inside the service is per-process and
 * therefore leaky on a platform that runs several; this one is the deliberate
 * limit, and it is here because a form a stranger can reach is a way to put
 * text on somebody's phone.
 */
const notes = createLimit({ capacity: 4, refillMs: 60 * 60 * 1000 })

export type SupportResult =
  { ok: true } | { ok: false; error: 'invalid_input' | 'rate_limited' | 'unavailable' }

/**
 * Passes a note from whoever is reading the app to whoever runs it.
 *
 * Nothing is stored: it goes to the chat and the row it would have been is not
 * written. A support inbox that also quietly becomes a table of what strangers
 * told you about themselves is a second thing to disclose, secure and delete.
 */
export async function sendSupport(input: unknown): Promise<SupportResult> {
  if (!alertsEnabled()) return { ok: false, error: 'unavailable' }

  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }

  const requestHeaders = await headers()
  if (!notes.take(clientKey(requestHeaders)).allowed) {
    return { ok: false, error: 'rate_limited' }
  }

  const session = await readSession()

  const result = await sendSupportMessage({
    body: parsed.data.body,
    // A session's own name beats anything typed into a box, and is the reason
    // the field is only shown to someone signed out.
    from: session?.sub ?? null,
    replyTo: session ? null : (parsed.data.replyTo ?? null),
    path: parsed.data.path ?? null,
    environment: environmentName(),
    requestId: requestHeaders.get(REQUEST_ID_HEADER),
  })

  // `skipped` is the per-process gate, which the person cannot tell apart from
  // being too quick — and being told to wait is more use than being told it
  // failed.
  if (result === 'skipped') return { ok: false, error: 'rate_limited' }
  if (result === 'failed') return { ok: false, error: 'unavailable' }
  return { ok: true }
}
