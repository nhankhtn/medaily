import { Skeleton } from '@/components/ui/skeleton'

/** The room list is a list, not a dashboard — its placeholder says so. */
export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-busy="true">
      <span className="sr-only">Loading</span>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-10 w-32 rounded-full sm:h-11" />
      </div>

      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[58px] w-full rounded-[var(--radius)]" />
        ))}
      </div>
    </div>
  )
}
