'use client'

import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import type { WeatherIconName, WeatherNow } from '@/lib/weather'
import { hereWeather } from './here'

const ICONS: Record<WeatherIconName, LucideIcon> = {
  sun: Sun,
  cloudSun: CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  thunder: CloudLightning,
  hail: CloudHail,
}

/**
 * Current weather beside the date, and the reading it opens.
 *
 * Open-Meteo returns a WMO code, not a picture. The chip and the dialog
 * both draw the icon that code maps to.
 */
export function WeatherDialog({ weather: initial }: { weather: WeatherNow }) {
  const t = useTranslations('weather')
  const format = useFormatter()
  const [open, setOpen] = useState(false)
  const [weather, setWeather] = useState(initial)
  const [located, setLocated] = useState(false)
  const Icon = ICONS[weather.icon]

  useEffect(() => {
    let dropped = false
    void hereWeather().then((next) => {
      if (dropped || !next) return
      setWeather(next)
      setLocated(true)
    })
    return () => {
      dropped = true
    }
  }, [])
  const condition = t(`conditions.${weather.condition}`)
  const temperature = format.number(weather.temperature, { maximumFractionDigits: 1 })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={t('open', { condition, temperature })}
          className="text-text-muted hover:bg-surface-2 hover:text-text flex h-9 shrink-0 items-center gap-1 rounded-full px-2"
        >
          <Icon className="size-4" />
          <span className="text-sm tabular-nums">{temperature}°</span>
        </button>
      </DialogTrigger>

      <DialogContent title={condition} description={located ? t('nearYou') : t('place')}>
        <div className="flex items-center gap-4">
          <span className="bg-accent-soft text-accent flex size-16 items-center justify-center rounded-full">
            <Icon className="size-8" />
          </span>
          <p className="text-4xl font-semibold tabular-nums">{temperature}°</p>
        </div>

        <dl className="mt-4">
          <Row
            label={t('humidity')}
            value={t('percent', {
              value: format.number(weather.humidity, { maximumFractionDigits: 0 }),
            })}
          />
          <Row
            label={t('precipitation')}
            value={t('millimetres', {
              value: format.number(weather.precipitation, { maximumFractionDigits: 1 }),
            })}
          />
          <Row
            label={t('rain')}
            value={t('millimetres', {
              value: format.number(weather.rain, { maximumFractionDigits: 1 }),
            })}
          />
          <Row
            label={t('cloudCover')}
            value={t('percent', {
              value: format.number(weather.cloudCover, { maximumFractionDigits: 0 }),
            })}
          />
        </dl>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border-base flex items-baseline justify-between gap-3 border-t py-2 text-sm">
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}
