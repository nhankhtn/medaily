'use client'

import { useEffect, useState } from 'react'

/** Tracks the resolved light/dark mode so charts can pick their own steps. */
export function useChartMode(): 'light' | 'dark' {
  const [mode, setMode] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const read = () => setMode(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
    read()

    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', read)

    return () => {
      observer.disconnect()
      media.removeEventListener('change', read)
    }
  }, [])

  return mode
}
