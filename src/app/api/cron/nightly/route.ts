import { NextResponse } from 'next/server'
import { formatBytes } from '@/lib/alerts/report'
import { log } from '@/lib/log'
import { refuseUnlessCron } from '@/server/cron-auth'
import { findAllUserIds } from '@/server/repositories/auth'
import { environmentName, sendJobReport } from '@/server/services/alerts'
import { rolloverBudgets } from '@/server/services/budget-rollover'
import { sweepNoteImages } from '@/server/services/note-images'
import { sweepRealtimeChannels } from '@/server/services/realtime-gc'

/**
 * Everything that runs once, overnight, for everybody. One schedule rather
 * than one per job — hobby crons fire to the nearest hour anyway.
 *
 * **Order is the design**, cheapest and most missed first: the budget rollover
 * (two queries, and the budget tab is blank without it), then the image sweep
 * (lists Cloudinary, might run long), then the channel sweep (nobody is
 * waiting; cut off, it finishes tomorrow). Each is caught separately.
 */
export async function GET(request: Request) {
  // Returned, not merely called. This route is in `PUBLIC_PATHS` — it never
  // meets the session gate — so this line is the only thing standing between
  // the open internet and a run that deletes images for every account.
  const refused = await refuseUnlessCron(request, 'nightly')
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

  // Only when it did something, or could not. A nightly "nothing happened" is
  // how a channel stops being read — and it carries the failures too.
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
        ...(sweepNote ? { 'Dọn kênh': sweepNote } : {}),
        // A document with no readable timestamp is left alone, not guessed at.
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
