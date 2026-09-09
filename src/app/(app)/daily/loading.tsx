import { Skeleton } from '@/components/ui/skeleton'

/** The daily log is a form, not a dashboard — its placeholder says so. */
export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-busy="true">
      <span className="sr-only">Loading</span>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-56" />
      </div>

      {['h-64', 'h-14', 'h-14'].map((height, index) => (
        <Skeleton key={index} className={`${height} w-full`} />
      ))}
    </div>
  )
}
