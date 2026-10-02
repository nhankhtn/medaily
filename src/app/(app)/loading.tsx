import { getTranslations } from 'next-intl/server'
import { PageShimmer } from '@/components/ui/shimmer'

/** The fallback for every route without its own — a module page's usual order. */
export default async function Loading() {
  const t = await getTranslations('common')
  return <PageShimmer label={t('loading')} subtitle={false} tiles={4} />
}
