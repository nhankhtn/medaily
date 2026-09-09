import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/ui/page'
import { GoalCards } from '@/features/goals/goal-cards'
import { GoalDialog } from '@/features/goals/goal-dialog'
import { getGoalsView } from '@/server/services/goals'

export default async function GoalsPage() {
  const [t, data] = await Promise.all([getTranslations('goals'), getGoalsView()])

  return (
    <div className="space-y-4">
      <PageHeader title={t('title')} action={<GoalDialog today={data.today} />} />
      <GoalCards goals={data.goals} today={data.today} />
    </div>
  )
}
