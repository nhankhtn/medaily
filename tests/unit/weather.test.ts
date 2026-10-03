import { describe, expect, it } from 'vitest'
import {
  forecastUrl,
  HCMC_FIX,
  describeWeather,
  parseForecast,
  sameWeatherFix,
  skyEmoji,
  weatherFix,
} from '@/lib/weather'

/** The reading Open-Meteo returned for Ho Chi Minh City on 2026-10-03. */
const NOW = {
  latitude: 10.790861,
  longitude: 106.6313,
  current: {
    time: '2026-10-03T14:45',
    interval: 900,
    temperature_2m: 28.1,
    relative_humidity_2m: 82,
    precipitation: 0.3,
    rain: 0.2,
    weather_code: 55,
    cloud_cover: 94,
  },
}

describe('open-meteo forecast', () => {
  it('reads the current block and turns code 55 into drizzle', () => {
    expect(parseForecast(NOW)).toEqual({
      temperature: 28.1,
      humidity: 82,
      precipitation: 0.3,
      rain: 0.2,
      code: 55,
      cloudCover: 94,
      condition: 'drizzle',
      icon: 'drizzle',
    })
  })

  it('refuses a body with no current reading', () => {
    expect(parseForecast({})).toBeNull()
    expect(parseForecast({ current: { temperature_2m: 28 } })).toBeNull()
    expect(parseForecast(null)).toBeNull()
  })

  it('uses the same reading for the greeting mark', () => {
    expect(skyEmoji('drizzle')).toBe('🌦️')
    expect(skyEmoji('clear')).toBe('☀️')
    expect(skyEmoji('thunder')).toBe('⛈️')
  })

  it('rounds a device position to about a kilometre', () => {
    expect(weatherFix(10.8231, 106.6297)).toEqual(HCMC_FIX)
    expect(
      sameWeatherFix(weatherFix(21.0285, 105.8542)!, { latitude: 21.03, longitude: 105.85 }),
    ).toBe(true)
    expect(weatherFix(91, 0)).toBeNull()
    expect(forecastUrl({ latitude: 21.03, longitude: 105.85 })).toBe(
      'https://api.open-meteo.com/v1/forecast?latitude=21.03&longitude=105.85&current=temperature_2m%2Crelative_humidity_2m%2Cprecipitation%2Crain%2Cweather_code%2Ccloud_cover&timezone=auto',
    )
  })

  it('picks an icon from the WMO code', () => {
    expect(describeWeather(0)).toEqual({ condition: 'clear', icon: 'sun' })
    expect(describeWeather(2)).toEqual({ condition: 'partlyCloudy', icon: 'cloudSun' })
    expect(describeWeather(95)).toEqual({ condition: 'thunder', icon: 'thunder' })
    expect(describeWeather(99)).toEqual({ condition: 'thunderHail', icon: 'hail' })
    expect(describeWeather(123)).toEqual({ condition: 'unknown', icon: 'cloud' })
  })
})
