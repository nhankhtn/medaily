import { getTranslations } from 'next-intl/server'
import { LoadingRegion, Shimmer, ShimmerCard } from '@/components/ui/shimmer'

/** Shaped like the console: the clock on the left, the ring and its controls on the right. */
export default async function Loading() {
  const t = await getTranslations('common')

  return (
    <LoadingRegion label={t('loading')}>
      <div className="space-y-2">
        <Shimmer className="h-8 w-40" />
        <Shimmer className="h-4 w-64 max-w-[70vw]" index={1} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <ShimmerCard className="flex flex-col gap-3">
          <Shimmer className="h-3.5 w-24" />
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6">
            <Shimmer className="h-12 w-40" index={1} />
            <Shimmer className="h-3.5 w-28" index={2} />
          </div>
        </ShimmerCard>

        <ShimmerCard className="flex flex-col items-center gap-5">
          <Shimmer className="h-8 w-56 rounded-full" index={1} />
          <Shimmer className="size-52 rounded-full" index={2} />
          <Shimmer className="h-11 w-40 rounded-full sm:h-12" index={3} />
        </ShimmerCard>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Shimmer key={i} glass className="h-[4.25rem]" index={i} />
        ))}
      </div>
    </LoadingRegion>
  )
}
