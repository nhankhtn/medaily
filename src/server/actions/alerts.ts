'use server'

import { z } from 'zod'
import { environmentName, reportError } from '@/server/services/alerts'

/**
 * A crash in the browser, which `onRequestError` never sees.
 *
 * Deliberately not behind the session check: the boundary that calls it fires
 * precisely when something is broken, sometimes the session itself, and a
 * report that needs a working app is a report that never arrives. What keeps
 * it from being a way to write into someone's chat is the shape — three short
 * fields, redacted, behind the same rate gate as everything else.
 */
const schema = z.object({
  message: z.string().max(300),
  digest: z.string().max(64).nullish(),
  path: z.string().max(200).nullish(),
  requestId: z.string().max(64).nullish(),
})

export async function reportClientError(input: unknown): Promise<void> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return

  await reportError({
    source: 'browser',
    environment: environmentName(),
    message: parsed.data.message,
    digest: parsed.data.digest ?? null,
    requestId: parsed.data.requestId ?? null,
    path: parsed.data.path ?? null,
  })
}
