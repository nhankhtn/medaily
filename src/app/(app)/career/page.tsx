import { getTranslations } from 'next-intl/server'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page'
import {
  AchievementDialog,
  AchievementList,
  PortfolioDialog,
  PortfolioList,
  SkillDialog,
  SkillList,
} from '@/features/career/career-ui'
import { getCareerData } from '@/server/services/career'

export default async function CareerPage() {
  const [t, data] = await Promise.all([getTranslations('career'), getCareerData()])

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('title')}
        action={<AchievementDialog today={data.today} />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('skills')} action={<SkillDialog />} />
          <CardBody>
            <SkillList skills={data.skills} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('achievements')} />
          <CardBody>
            <AchievementList items={data.achievements} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title={t('portfolio')} action={<PortfolioDialog />} />
          <CardBody>
            <PortfolioList items={data.portfolio} />
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
