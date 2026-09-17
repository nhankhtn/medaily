'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { TOUR_STEPS, tourHref } from '@/lib/onboarding/tour'

/**
 * Starts the tour where it belongs — on the first page it is about — rather
 * than opening something on top of the dashboard. Renders nothing; the guide in
 * the layout takes over from the marker this puts in the address.
 */
export function TourStart() {
  const router = useRouter()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const first = TOUR_STEPS[0]
    if (first) router.replace(tourHref(first))
  }, [router])

  return null
}
