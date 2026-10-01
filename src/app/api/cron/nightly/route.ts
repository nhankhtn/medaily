import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { formatBytes } from '@/lib/alerts/report'
import { env } from '@/lib/env'
import { log } from '@/lib/log'
import { findAllUserIds } from '@/server/repositories/auth'
import { environmentName, sendJobReport } from '@/server/services/alerts'
import { rolloverBudgets } from '@/server/services/budget-rollover'
import { sweepNoteImages } from '@/server/services/note-images'
import { sweepRealtimeChannels } from '@/server/services/realtime-gc'

/**
 * Everything that runs once, overnight, for everybody.
 *
 * One schedule rather than one per job. Hobby cron jobs fire once a day and
 * only to the nearest hour anyway, so two of them buy no precision — and a
 * second job would have meant a second route, a second secret check and a
 * second message on the phone for work nobody times separately.
 *
 * **Order is the whole design.** The rollover is two queries and it is the
 * one somebody notices missing: without it the budget tab is blank on the
 * first of the month. The image sweep lists a Cloudinary folder and reads
 * every text column the account owns, so it is the one that might run long
 * enough to be cut off. Cheap and needed goes first; expensive and optional
 * goes second, where being cut off costs a night rather than a month.
 *
 * The channel sweep goes last for the same reason taken further: it deletes
 * orphaned doorbell documents, which nobody is waiting for and which cost a
 * few hundred bytes a room. Cut off, it finishes tomorrow.
 *
 * None can take another down: each account is caught on its own inside the
 * services, and each half is caught separately here.
 */
export async function GET(request: Request) {
  // Returned, not merely called. This route is in `PUBLIC_PATHS` — it never
  // meets the session gate — so this line is the only thing standing between
  // the open internet and a run that deletes images for every account.
  const refused = await validateCronSecret(request)
  if (refused) return refused

  const startedAt = Date.now()
  const userIds = await findAllUserIds()

  // One after another, which is what the ordering above is for. Run together,
  // a timeout would cut whichever happened to be unfinished and the rollover
  // would have no priority at all.
  const budgets = await handleRolloverBudgets(userIds)
  const images = await handleSweepNoteImages(userIds)
  const realtime = await handleSweepRealtimeChannels()

  log.info('cron', 'nightly run completed', {
    budgets,
    images,
    realtime,
    accounts: userIds.length,
  })

  /*
   * Only when it did something, or could not. Most nights it copies nothing
   * and deletes nothing, and a message saying so every night is how a channel
   * stops being read — which matters because the same channel carries the
   * failures.
   */
  const didSomething =
    budgets.created > 0 || images.removed > 0 || realtime.channels > 0 || realtime.typing > 0
  const wentWrong = budgets.failed > 0 || images.failed > 0 || realtime.failed > 0

  const sweepNote =
    realtime.failed > 0 ? 'lỗi' : realtime.capped ? 'đã tới giới hạn, còn tiếp đêm mai' : null

  if (didSomething || wentWrong) {
    await sendJobReport({
      job: 'Việc đêm',
      environment: environmentName(),
      tookMs: Date.now() - startedAt,
      counts: {
        'Dòng ngân sách đã chép': budgets.created,
        'Ảnh đã xóa': images.removed,
        'Dung lượng thu hồi': formatBytes(images.freedBytes),
        'Kênh chat đã dọn': `${realtime.channels} phòng · ${realtime.typing} trạng thái gõ`,
        // One key, decided once. Two spreads both writing 'Dọn kênh' would
        // have let whichever came last silently win.
        ...(sweepNote ? { 'Dọn kênh': sweepNote } : {}),
        // Worth seeing once, not every night: a document with no readable
        // timestamp is left alone rather than guessed at.
        ...(realtime.skipped > 0
          ? { 'Document không đọc được mốc thời gian': realtime.skipped }
          : {}),
        ...(wentWrong
          ? { 'Tài khoản lỗi': `${budgets.failed} ngân sách · ${images.failed} ảnh` }
          : {}),
      },
    })
  }

  return NextResponse.json({ budgets, images, realtime, accounts: userIds.length })
}

/** Answers with the refusal to send back, or nothing when the caller is allowed. */
const validateCronSecret = async (request: Request): Promise<NextResponse | null> => {
  const userAgent = request.headers.get('user-agent') ?? ''
  const caller = userAgent.startsWith('vercel-cron') ? 'the scheduler' : 'an unknown caller'
  const secret = env.CRON_SECRET
  if (!secret) {
    await log.error('cron', 'the nightly run cannot start: CRON_SECRET is not set', { userAgent })
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }
  if (!sameSecret(request.headers.get('authorization'), `Bearer ${secret}`)) {
    await log.error('cron', `the nightly run refused ${caller}: wrong or missing secret`, {
      userAgent,
    })
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  return null
}

/** Constant-time, so the response time says nothing about how much of the secret matched. */
function sameSecret(given: string | null, expected: string): boolean {
  if (given === null) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

const handleSweepNoteImages = async (userIds: string[]) => {
  const images = { removed: 0, freedBytes: 0, failed: 0 }
  for (const userId of userIds) {
    try {
      const result = await sweepNoteImages(userId)
      images.removed += result.removed
      images.freedBytes += result.freedBytes
    } catch (error) {
      images.failed += 1
      await log.error('media', `note image sweep failed for ${userId}`, error)
    }
  }
  return images
}

const handleRolloverBudgets = async (userIds: string[]) => {
  const budgets = { created: 0, failed: 0 }
  for (const userId of userIds) {
    try {
      budgets.created += (await rolloverBudgets(userId)).created
    } catch (error) {
      budgets.failed += 1
      await log.error('finance', `budget rollover failed for ${userId}`, error)
    }
  }
  return budgets
}

const handleSweepRealtimeChannels = async () => {
  const realtime = { channels: 0, typing: 0, skipped: 0, capped: false, failed: 0 }

  try {
    const swept = await sweepRealtimeChannels()
    if (swept) Object.assign(realtime, swept)
  } catch (error) {
    realtime.failed += 1
    await log.error('realtime', 'the channel sweep failed', error)
  }
  return realtime
}
