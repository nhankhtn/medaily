import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/ui/page'
import { HabitDialog } from '@/features/habits/habit-dialog'
import { HabitList } from '@/features/habits/habit-list'
import { getHabitsView } from '@/server/services/habits'

export default async function HabitsPage() {
  const [t, data] = await Promise.all([getTranslations('habits'), getHabitsView()])

  return (
    <div className="space-y-4">
      <PageHeader title={t('title')} action={<HabitDialog today={data.today} />} />
      <HabitList habits={data.habits} today={data.today} />
    </div>
  )
}
