'use client'

import { loadWeatherAt } from '@/server/actions/weather'
import { HCMC_FIX, sameWeatherFix, weatherFix, type WeatherNow } from '@/lib/weather'

export type HereOutcome = { ok: true; weather: WeatherNow } | { ok: false; blocked: boolean }

let pending: Promise<HereOutcome> | null = null
const listeners = new Set<(outcome: HereOutcome) => void>()

/**
 * One look-up for the header and the greeting.
 *
 * The browser may already know a recent position (`maximumAge`), so a second
 * page does not ask again. Declining, or standing in Ho Chi Minh City, keeps
 * the reading the server already drew.
 */
export function hereWeather(): Promise<HereOutcome> {
  pending ??= ask()
  return pending
}

/**
 * A tap on the weather chip.
 *
 * The first look-up is cached, including a refusal, so a later tap has to
 * start its own. The prompt only appears from a gesture, and only while the
 * browser is still willing to ask.
 */
export function requestHereWeather(): Promise<HereOutcome> {
  const task = ask()
  pending = task
  void task.then((outcome) => {
    if (outcome.ok) listeners.forEach((listener) => listener(outcome))
  })
  return task
}

export function subscribeHere(listener: (outcome: HereOutcome) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

async function ask(): Promise<HereOutcome> {
  const found = await deviceFix()
  if (!found.fix || sameWeatherFix(found.fix, HCMC_FIX)) {
    return { ok: false, blocked: found.blocked }
  }
  const weather = await loadWeatherAt(found.fix).catch(() => null)
  return weather ? { ok: true, weather } : { ok: false, blocked: false }
}

function deviceFix(): Promise<{ fix: ReturnType<typeof weatherFix>; blocked: boolean }> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({ fix: null, blocked: false })
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          fix: weatherFix(position.coords.latitude, position.coords.longitude),
          blocked: false,
        }),
      (error) => resolve({ fix: null, blocked: error.code === error.PERMISSION_DENIED }),
      // Coarse is enough: the forecast is rounded to a kilometre anyway.
      { enableHighAccuracy: false, maximumAge: 30 * 60 * 1000, timeout: 8_000 },
    )
  })
}
