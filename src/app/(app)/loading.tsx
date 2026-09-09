import { PageSkeleton } from '@/components/ui/skeleton'

/**
 * Every page in the app group is server-rendered per request, and the database
 * is remote — without this boundary a click leaves the reader staring at the
 * previous page for the whole round trip. With it, navigation swaps instantly
 * and the content streams in.
 */
export default function Loading() {
  return <PageSkeleton />
}
