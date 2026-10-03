'use server'

import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { weatherFix, type WeatherNow } from '@/lib/weather'
import { readWeather } from '@/server/services/weather'

const position = z.object({
  latitude: z.number(),
  longitude: z.number(),
})

/**
 * The forecast for where this browser says it is.
 *
 * The shell already painted Ho Chi Minh City. This replaces it once, after
 * the person allows the prompt. A refused or impossible fix leaves that
 * first reading alone.
 */
export async function loadWeatherAt(input: unknown): Promise<WeatherNow | null> {
  await getCurrentUserId()
  const parsed = position.safeParse(input)
  if (!parsed.success) return null
  const fix = weatherFix(parsed.data.latitude, parsed.data.longitude)
  if (!fix) return null
  return readWeather(fix)
}
