import { NextResponse } from 'next/server'
import { formatBytes } from '@/lib/alerts/report'
import { env } from '@/lib/env'
import { log } from '@/lib/log'
import { findAllUserIds } from '@/server/repositories/auth'
import { environmentName, sendJobReport } from '@/server/services/alerts'
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
 *
 * It reports to Telegram when it finishes, which is the only way to tell a
 * sweep that found nothing from one that never ran: an unregistered cron, an
 * unset `CRON_SECRET` and a dropped `vercel.json` all fail by being silent,
 * and silence is exactly what an error channel cannot report. Per-account
 * failures already go through `log.error`, which sends to the same chat, so
 * this one only has to say it got to the end.
 */
export async function GET(request: Request) {
  /*
   * Whether the caller looks like the scheduler rather than a stranger.
   *
   * It is in the message on purpose, and it is the only thing from the request
   * that is: the alert gate keys on the message, so anything with more than a
   * couple of possible values — a user agent, an address — would give every
   * caller its own key and turn the gate off for exactly the traffic it is
   * there to hold back. Two values keep it working, and they separate the two
   * causes worth telling apart: a cron that is misconfigured, and somebody
   * knocking. The full user agent goes to the console beside it.
   */
  const userAgent = request.headers.get('user-agent') ?? ''
  const caller = userAgent.startsWith('vercel-cron') ? 'the scheduler' : 'an unknown caller'

  const secret = env.CRON_SECRET
  // Without a secret this would be a route anyone can make do real work.
  if (!secret) {
    /*
     * The loudest of the three, and the one that used to be silent. A deploy
     * without the variable answers 503 to every nightly run and deletes
     * nothing, for as long as nobody happens to look — which is indefinitely,
     * because nothing fails, throws or appears anywhere.
     */
    await log.error('media', 'note image sweep cannot run: CRON_SECRET is not set', { userAgent })
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    await log.error('media', `note image sweep refused ${caller}: wrong or missing secret`, {
      userAgent,
    })
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  let removed = 0
  let freedBytes = 0
  let failed = 0
  let accounts = 0

  for (const userId of await findAllUserIds()) {
    accounts += 1
    try {
      const result = await sweepNoteImages(userId)
      removed += result.removed
      freedBytes += result.freedBytes
    } catch (error) {
      failed += 1
      await log.error('media', `note image sweep failed for ${userId}`, error)
    }
  }

  log.info('media', `note image sweep completed`, { removed, freedBytes, failed })

  /*
   * Awaited, not fired and forgotten. The reply here is read by a scheduler
   * that does nothing with it, while on a serverless platform returning first
   * is what lets the invocation be frozen mid-send — so the one caller with
   * nothing to wait for is the one that can afford to wait.
   */
  await sendJobReport({
    job: 'Dọn ảnh ghi chú',
    environment: environmentName(),
    tookMs: Date.now() - startedAt,
    counts: {
      'Ảnh đã xóa': removed,
      'Dung lượng thu hồi': formatBytes(freedBytes),
      'Tài khoản đã quét': accounts,
      // Only when there were any: a zero here reads as a warning that is not
      // one, every night, until it stops being read at all.
      ...(failed > 0 ? { 'Tài khoản lỗi': failed } : {}),
    },
  })

  return NextResponse.json({ removed, freedBytes, failed })
}
