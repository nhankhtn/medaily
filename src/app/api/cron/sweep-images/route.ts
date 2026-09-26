import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { log } from '@/lib/log'
import { findAllUserIds } from '@/server/repositories/auth'
import { sweepNoteImages } from '@/server/services/note-images'

/**
 * Deletes note images nothing points at any more, for everyone.
 *
 * On a schedule rather than on a request: it lists a Cloudinary folder and
 * reads every text column the account owns, which is far too much to hang off
 * a page load, and it is not work anybody should have to remember to ask for.
 *
 * One account's failure is logged and the next one still runs — a sweep that
 * stops at the first error would quietly stop sweeping everyone behind it.
 */
export async function GET(request: Request) {
  const secret = env.CRON_SECRET
  // Without a secret this would be a route anyone can make do real work.
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let removed = 0
  let freedBytes = 0
  let failed = 0

  for (const userId of await findAllUserIds()) {
    try {
      const result = await sweepNoteImages(userId)
      removed += result.removed
      freedBytes += result.freedBytes
    } catch (error) {
      failed += 1
      await log.error('media', `note image sweep failed for ${userId}`, error)
    }
  }

  return NextResponse.json({ removed, freedBytes, failed })
}
