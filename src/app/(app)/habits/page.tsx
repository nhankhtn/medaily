import { getTranslations } from 'next-intl/server'
import { HabitList } from '@/features/habits/habit-list'
import { getHabitsView } from '@/server/services/habits'

export default async function HabitsPage() {
  const [t, data] = await Promise.all([getTranslations('habits'), getHabitsView()])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <HabitList habits={data.habits} today={data.today} />
    </div>
  )
}
