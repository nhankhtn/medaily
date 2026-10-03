'use client'

import { loadWeatherAt } from '@/server/actions/weather'
import { HCMC_FIX, sameWeatherFix, weatherFix, type WeatherNow } from '@/lib/weather'

let pending: Promise<WeatherNow | null> | null = null

/**
 * One look-up for the header and the greeting.
 *
 * The browser may already know a recent position (`maximumAge`), so a second
 * page does not ask again. Declining, or standing in Ho Chi Minh City, keeps
 * the reading the server already drew.
 */
export function hereWeather(): Promise<WeatherNow | null> {
  pending ??= ask()
  return pending
}

async function ask(): Promise<WeatherNow | null> {
  const fix = await deviceFix()
  if (!fix || sameWeatherFix(fix, HCMC_FIX)) return null
  return loadWeatherAt(fix).catch(() => null)
}

function deviceFix() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
  return new Promise<ReturnType<typeof weatherFix>>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(weatherFix(position.coords.latitude, position.coords.longitude)),
      () => resolve(null),
      // Coarse is enough: the forecast is rounded to a kilometre anyway.
      { enableHighAccuracy: false, maximumAge: 30 * 60 * 1000, timeout: 8_000 },
    )
  })
}
