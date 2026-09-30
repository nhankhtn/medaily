import { NextResponse } from 'next/server'
import { formatBytes } from '@/lib/alerts/report'
import { env } from '@/lib/env'
import { log } from '@/lib/log'
import { findAllUserIds } from '@/server/repositories/auth'
import { environmentName, sendJobReport } from '@/server/services/alerts'
import { rolloverBudgets } from '@/server/services/budget-rollover'
import { sweepNoteImages } from '@/server/services/note-images'

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
 * Neither can take the other down: each account is caught on its own inside
 * the services, and the two halves are caught separately here.
 */
export async function GET(request: Request) {
  const userAgent = request.headers.get('user-agent') ?? ''
  const caller = userAgent.startsWith('vercel-cron') ? 'the scheduler' : 'an unknown caller'

  const secret = env.CRON_SECRET
  if (!secret) {
    await log.error('cron', 'the nightly run cannot start: CRON_SECRET is not set', { userAgent })
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    await log.error('cron', `the nightly run refused ${caller}: wrong or missing secret`, {
      userAgent,
    })
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const userIds = await findAllUserIds()

  const budgets = { created: 0, failed: 0 }
  const images = { removed: 0, freedBytes: 0, failed: 0 }

  for (const userId of userIds) {
    try {
      budgets.created += (await rolloverBudgets(userId)).created
    } catch (error) {
      budgets.failed += 1
      await log.error('finance', `budget rollover failed for ${userId}`, error)
    }
  }

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

  log.info('cron', 'nightly run completed', { budgets, images, accounts: userIds.length })

  /*
   * Only when it did something, or could not. Most nights it copies nothing
   * and deletes nothing, and a message saying so every night is how a channel
   * stops being read — which matters because the same channel carries the
   * failures.
   */
  const didSomething = budgets.created > 0 || images.removed > 0
  const wentWrong = budgets.failed > 0 || images.failed > 0

  if (didSomething || wentWrong) {
    await sendJobReport({
      job: 'Việc đêm',
      environment: environmentName(),
      tookMs: Date.now() - startedAt,
      counts: {
        'Dòng ngân sách đã chép': budgets.created,
        'Ảnh đã xóa': images.removed,
        'Dung lượng thu hồi': formatBytes(images.freedBytes),
        ...(wentWrong
          ? { 'Tài khoản lỗi': `${budgets.failed} ngân sách · ${images.failed} ảnh` }
          : {}),
      },
    })
  }

  return NextResponse.json({ budgets, images, accounts: userIds.length })
}
