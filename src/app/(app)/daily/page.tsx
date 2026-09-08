import { DailyPage } from '@/features/daily/daily-page'
import { today } from '@/lib/dates'
import { getDayContext } from '@/server/services/settings'

export default async function TodayPage() {
  const ctx = await getDayContext()
  return <DailyPage date={today(ctx)} />
}
