import { log } from '@/lib/log'
import {
  parseForecast,
  WEATHER_FORECAST_URL,
  WEATHER_FRESH_FOR_S,
  type WeatherNow,
} from '@/lib/weather'

/**
 * The reading behind the header chip.
 *
 * Cached for 15 minutes, so opening the dialog does not ask Open-Meteo again.
 * A failure leaves the chip off: the date in the header is not worth holding
 * up, and a blank sky is quieter than an error in the shell.
 */
export async function readWeather(): Promise<WeatherNow | null> {
  try {
    const response = await fetch(WEATHER_FORECAST_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'medaily' },
      signal: AbortSignal.timeout(4_000),
      next: { revalidate: WEATHER_FRESH_FOR_S },
    })
    if (!response.ok) {
      void log.warn('weather', `forecast refused: ${response.status}`)
      return null
    }
    const weather = parseForecast(await response.json())
    if (!weather) void log.warn('weather', 'forecast had no current reading')
    return weather
  } catch (error) {
    void log.warn('weather', 'forecast unavailable', error)
    return null
  }
}
