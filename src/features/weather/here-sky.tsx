'use client'

import { useEffect, useState } from 'react'
import { skyEmoji } from '@/lib/weather'
import { hereWeather } from './here'

/** The greeting mark. Starts as the server reading, then follows the device. */
export function HereSky({ initial }: { initial: string }) {
  const [mark, setMark] = useState(initial)

  useEffect(() => {
    let dropped = false
    void hereWeather().then((next) => {
      if (dropped || !next) return
      setMark(skyEmoji(next.condition))
    })
    return () => {
      dropped = true
    }
  }, [])

  return mark
}
