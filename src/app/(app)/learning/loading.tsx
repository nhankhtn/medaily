import { getTranslations } from 'next-intl/server'
import { PageShimmer } from '@/components/ui/shimmer'

export default async function Loading() {
  const t = await getTranslations('common')
  return <PageShimmer label={t('loading')} tabs={3} cards={['rows', 'rows']} />
}
