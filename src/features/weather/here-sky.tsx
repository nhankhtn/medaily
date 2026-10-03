'use client'

import { useEffect, useState } from 'react'
import { skyEmoji } from '@/lib/weather'
import { hereWeather, subscribeHere, type HereOutcome } from './here'

/** The greeting mark. Starts as the server reading, then follows the device. */
export function HereSky({ initial }: { initial: string }) {
  const [mark, setMark] = useState(initial)

  useEffect(() => {
    let dropped = false
    const apply = (outcome: HereOutcome) => {
      if (dropped || !outcome.ok) return
      setMark(skyEmoji(outcome.weather.condition))
    }
    void hereWeather().then(apply)
    const stop = subscribeHere(apply)
    return () => {
      dropped = true
      stop()
    }
  }, [])

  return mark
}
