import { getTranslations } from 'next-intl/server'
import { PageShimmer } from '@/components/ui/shimmer'

export default async function Loading() {
  const t = await getTranslations('common')
  return <PageShimmer label={t('loading')} tiles={4} cards={['chart']} />
}
