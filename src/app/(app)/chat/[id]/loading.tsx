import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * A room, before the room arrives.
 *
 * The group's placeholder is `PageSkeleton` from the route group above, which
 * draws a title, four stat tiles and two cards — the shape of a dashboard, and
 * nothing a conversation has. Opening a room flashed that and then replaced it
 * wholesale, which reads as a glitch rather than as loading.
 *
 * So this is the room's own shape, and the nesting matters as much as the
 * boxes: the composer lives *inside* the card, under the transcript, because
 * that is where `RoomView` puts it. Drawn outside, every room opened with a
 * visible jump as the composer fell into place.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn(
        'flex min-h-0 flex-col gap-4',
        // Copied from the page rather than shared: two numbers that have to
        // agree, and a wrapper to hold them would be a third thing to keep in
        // step. If the page's arithmetic changes, change it here too.
        'h-[calc(100dvh-max(0.75rem,env(safe-area-inset-top,0px))-3.5rem-1rem-max(0.75rem,env(safe-area-inset-bottom,0px)))]',
        '-mb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] md:mb-0',
        'md:h-[calc(100dvh-max(0.75rem,env(safe-area-inset-top,0px))-3.5rem-1rem-2rem)]',
      )}
    >
      <span className="sr-only">Loading</span>

      <div className="flex shrink-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="min-w-0 space-y-2 pt-1">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="size-10 shrink-0 rounded-full" />
      </div>

      <Card className="chat-wallpaper flex min-h-0 flex-1 flex-col gap-3 p-2 sm:p-3">
        {/*
          * Alternating sides and uneven widths, because that is what makes a
          * block of grey read as a conversation rather than as a table. They
          * sit at the bottom: the newest line is the one a room opens on.
          */}
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-4 px-1">
          {[
            'w-32 self-start',
            'w-44 self-start',
            'w-28 self-end',
            'w-40 self-start',
            'w-52 self-end',
          ].map((shape, index) => (
            <Skeleton key={index} className={cn('h-9 rounded-2xl', shape)} />
          ))}
        </div>

        <div className="flex shrink-0 items-end gap-1 sm:gap-2">
          <Skeleton className="size-10 shrink-0 rounded-full sm:size-11" />
          <Skeleton className="h-10 flex-1 rounded-[var(--radius)] sm:h-11" />
          <Skeleton className="size-10 shrink-0 rounded-full sm:h-11 sm:w-26" />
        </div>
      </Card>
    </div>
  )
}
