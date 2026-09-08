import { notFound, redirect } from 'next/navigation'
import { DailyPage } from '@/features/daily/daily-page'
import { isISODate, today } from '@/lib/dates'
import { getDayContext } from '@/server/services/settings'

export default async function DailyByDatePage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  if (!isISODate(date)) notFound()

  const ctx = await getDayContext()
  const logicalToday = today(ctx)

  // Future days have no log to edit — planning lives in Calendar (spec 5.3).
  if (date > logicalToday) redirect('/daily')

  return <DailyPage date={date} />
}
