import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/ui/page'
import { TimerConsole } from '@/features/timer/timer-console'
import { getTimerPageData } from '@/server/services/timer'

export default async function TimerPage() {
  const [t, data] = await Promise.all([getTranslations('timer'), getTimerPageData()])

  return (
    <div className="space-y-4">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <TimerConsole data={data} />
    </div>
  )
}
