import { NextResponse } from 'next/server'
import { log } from '@/lib/log'
import { refuseUnlessCron } from '@/server/cron-auth'
import { remindBlankDays } from '@/server/services/log-reminder'

/**
 * The evening reminder, once a day at 13:00 UTC — 20:00 in Vietnam.
 *
 * Its own schedule rather than a step in the nightly run: that one fires at
 * midnight, when a reminder to log the day would wake somebody to tell them
 * it is over. Hobby cron fires anywhere inside the hour, so this lands
 * between 20:00 and 20:59, which is fine for a nudge.
 */
export async function GET(request: Request) {
  const refused = await refuseUnlessCron(request, 'reminder')
  if (refused) return refused

  try {
    const run = await remindBlankDays()
    log.info('cron', 'reminder run completed', run)
    return NextResponse.json(run)
  } catch (error) {
    await log.error('cron', 'the reminder run failed', error)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
