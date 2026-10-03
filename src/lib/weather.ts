/**
 * Current weather for Ho Chi Minh City, from Open-Meteo.
 *
 * The forecast answers with a WMO code, not a picture. The icon is chosen
 * here from that code; nothing else is downloaded.
 *
 * https://api.open-meteo.com/v1/forecast?latitude=10.8231&longitude=106.6297&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,cloud_cover&timezone=Asia/Ho_Chi_Minh
 */
export const WEATHER_FORECAST_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=10.8231&longitude=106.6297&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,cloud_cover&timezone=Asia/Ho_Chi_Minh'

/** How long a reading stays current. Open-Meteo steps `current` every 15 minutes. */
export const WEATHER_FRESH_FOR_S = 15 * 60

export const WEATHER_CONDITIONS = [
  'clear',
  'mainlyClear',
  'partlyCloudy',
  'overcast',
  'fog',
  'drizzle',
  'freezingDrizzle',
  'rain',
  'freezingRain',
  'snow',
  'showers',
  'snowShowers',
  'thunder',
  'thunderHail',
  'unknown',
] as const

export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number]

export type WeatherIconName =
  'sun' | 'cloudSun' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunder' | 'hail'

export type WeatherNow = {
  temperature: number
  humidity: number
  precipitation: number
  rain: number
  code: number
  cloudCover: number
  condition: WeatherCondition
  icon: WeatherIconName
}

const BY_CODE: Record<number, Pick<WeatherNow, 'condition' | 'icon'>> = {
  0: { condition: 'clear', icon: 'sun' },
  1: { condition: 'mainlyClear', icon: 'sun' },
  2: { condition: 'partlyCloudy', icon: 'cloudSun' },
  3: { condition: 'overcast', icon: 'cloud' },
  45: { condition: 'fog', icon: 'fog' },
  48: { condition: 'fog', icon: 'fog' },
  51: { condition: 'drizzle', icon: 'drizzle' },
  53: { condition: 'drizzle', icon: 'drizzle' },
  55: { condition: 'drizzle', icon: 'drizzle' },
  56: { condition: 'freezingDrizzle', icon: 'drizzle' },
  57: { condition: 'freezingDrizzle', icon: 'drizzle' },
  61: { condition: 'rain', icon: 'rain' },
  63: { condition: 'rain', icon: 'rain' },
  65: { condition: 'rain', icon: 'rain' },
  66: { condition: 'freezingRain', icon: 'rain' },
  67: { condition: 'freezingRain', icon: 'rain' },
  71: { condition: 'snow', icon: 'snow' },
  73: { condition: 'snow', icon: 'snow' },
  75: { condition: 'snow', icon: 'snow' },
  77: { condition: 'snow', icon: 'snow' },
  80: { condition: 'showers', icon: 'rain' },
  81: { condition: 'showers', icon: 'rain' },
  82: { condition: 'showers', icon: 'rain' },
  85: { condition: 'snowShowers', icon: 'snow' },
  86: { condition: 'snowShowers', icon: 'snow' },
  95: { condition: 'thunder', icon: 'thunder' },
  96: { condition: 'thunderHail', icon: 'hail' },
  99: { condition: 'thunderHail', icon: 'hail' },
}

/** A code this build does not know still has an icon, and says so. */
export function describeWeather(code: number): Pick<WeatherNow, 'condition' | 'icon'> {
  return BY_CODE[code] ?? { condition: 'unknown', icon: 'cloud' }
}

/** The mark in the daily greeting. Same reading as the header chip, as an emoji. */
const SKY: Record<WeatherCondition, string> = {
  clear: '☀️',
  mainlyClear: '🌤️',
  partlyCloudy: '⛅',
  overcast: '☁️',
  fog: '🌫️',
  drizzle: '🌦️',
  freezingDrizzle: '🌧️',
  rain: '🌧️',
  freezingRain: '🌧️',
  snow: '❄️',
  showers: '🌦️',
  snowShowers: '🌨️',
  thunder: '⛈️',
  thunderHail: '⛈️',
  unknown: '☁️',
}

export function skyEmoji(condition: WeatherCondition): string {
  return SKY[condition]
}

/**
 * The `current` object from a forecast response. A missing or mistyped field
 * is no weather, rather than a dialog full of NaN.
 */
export function parseForecast(body: unknown): WeatherNow | null {
  if (!body || typeof body !== 'object') return null
  const current = (body as { current?: unknown }).current
  if (!current || typeof current !== 'object') return null
  const row = current as Record<string, unknown>

  const temperature = num(row.temperature_2m)
  const humidity = num(row.relative_humidity_2m)
  const precipitation = num(row.precipitation)
  const rain = num(row.rain)
  const code = num(row.weather_code)
  const cloudCover = num(row.cloud_cover)
  if (
    temperature === null ||
    humidity === null ||
    precipitation === null ||
    rain === null ||
    code === null ||
    cloudCover === null ||
    !Number.isInteger(code)
  ) {
    return null
  }

  return { temperature, humidity, precipitation, rain, code, cloudCover, ...describeWeather(code) }
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
