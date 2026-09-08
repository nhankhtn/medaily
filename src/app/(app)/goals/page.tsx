import { getTranslations } from 'next-intl/server'
import { GoalCards } from '@/features/goals/goal-cards'
import { getGoalsView } from '@/server/services/goals'

export default async function GoalsPage() {
  const [t, data] = await Promise.all([getTranslations('goals'), getGoalsView()])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <GoalCards goals={data.goals} />
    </div>
  )
}
