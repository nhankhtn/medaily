'use client'

import { Loader2, RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DEFAULT_SCORE_WEIGHTS } from '@/lib/defaults'
import { weightsAreValid } from '@/lib/scoring'
import { SCORE_COMPONENTS, type ScoreWeights } from '@/lib/types'
import { resetScoreDefaults, updateUserSettings } from '@/server/actions/settings'
import type { ResolvedSettings } from '@/server/services/settings'
import { cn } from '@/lib/utils'

const TIMEZONES = [
  'Asia/Ho_Chi_Minh',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
]

export function SettingsForm({ settings }: { settings: ResolvedSettings }) {
  const t = useTranslations('settings')
  const ts = useTranslations('score')
  const tc = useTranslations('common')
  const [pending, startTransition] = useTransition()
  const [weights, setWeights] = useState<ScoreWeights>(settings.scoreWeights)

  const weightTotal = Object.values(weights).reduce((sum, value) => sum + value, 0)
  const weightsValid = weightsAreValid(weights)

  const save = (patch: Record<string, unknown>) => {
    startTransition(async () => {
      const result = await updateUserSettings(patch)
      if (!result.ok) {
        toast.error(tc('error'))
        return
      }
      toast.success(t('savedToast'))
    })
  }

  return (
    <div className="space-y-4">
      <Section title={t('timezone')} help={t('timezoneHelp')}>
        <select
          value={settings.timezone}
          disabled={pending}
          aria-label={t('timezone')}
          onChange={(event) => save({ timezone: event.target.value })}
          className="h-11 w-full rounded-[var(--radius)] border border-border-strong bg-surface px-3 text-base"
        >
          {[...new Set([settings.timezone, ...TIMEZONES])].map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </Section>

      <Section title={t('dayRollover')} help={t('dayRolloverHelp')}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={8}
            className="w-24 text-center tabular-nums"
            defaultValue={settings.dayRolloverHour}
            aria-label={t('dayRollover')}
            onBlur={(event) => {
              const value = Number(event.target.value)
              if (value !== settings.dayRolloverHour) save({ dayRolloverHour: value })
            }}
          />
          <span className="text-sm text-text-subtle">:00</span>
        </div>
      </Section>

      <Section title={t('weekStart')}>
        <div className="flex gap-2">
          {(['monday', 'sunday'] as const).map((option) => (
            <Button
              key={option}
              variant={settings.weekStart === option ? 'primary' : 'outline'}
              size="sm"
              disabled={pending}
              onClick={() => save({ weekStart: option })}
            >
              {t(option)}
            </Button>
          ))}
        </div>
      </Section>

      <Section title={t('streakGrace')} help={t('streakGraceHelp')}>
        <button
          type="button"
          role="switch"
          aria-checked={settings.streakGraceEnabled}
          disabled={pending}
          onClick={() => save({ streakGraceEnabled: !settings.streakGraceEnabled })}
          className={cn(
            'relative h-7 w-12 rounded-full transition-colors',
            settings.streakGraceEnabled ? 'bg-accent' : 'bg-border-strong',
          )}
        >
          <span
            className={cn(
              'absolute top-1 size-5 rounded-full bg-white transition-[left]',
              settings.streakGraceEnabled ? 'left-6' : 'left-1',
            )}
          />
        </button>
      </Section>

      <Section title={t('scoreWeights')} help={t('scoreWeightsHelp')}>
        <div className="space-y-2">
          {SCORE_COMPONENTS.map((component) => (
            <div key={component} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-sm text-text-muted">
                {ts(`components.${component}`)}
              </span>
              <input
                type="range"
                min={0}
                max={60}
                step={5}
                value={weights[component]}
                aria-label={ts(`components.${component}`)}
                onChange={(event) =>
                  setWeights((prev) => ({ ...prev, [component]: Number(event.target.value) }))
                }
                className="flex-1 accent-[var(--accent)]"
              />
              <span className="w-12 shrink-0 text-right text-sm tabular-nums">
                {weights[component]}%
              </span>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <span
              className={cn(
                'text-sm tabular-nums',
                weightsValid ? 'text-good' : 'text-bad',
              )}
            >
              {weightTotal}%
            </span>
            <Button
              size="sm"
              disabled={pending || !weightsValid}
              onClick={() => save({ scoreWeights: weights })}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              {tc('save')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setWeights(DEFAULT_SCORE_WEIGHTS)
                startTransition(async () => {
                  await resetScoreDefaults()
                  toast.success(t('savedToast'))
                })
              }}
            >
              <RotateCcw className="size-3.5" />
              {t('resetDefaults')}
            </Button>
          </div>
        </div>
      </Section>
    </div>
  )
}

function Section({
  title,
  help,
  children,
}: {
  title: string
  help?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[var(--radius)] border border-border-base bg-surface p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {help ? <p className="mt-0.5 mb-3 text-xs leading-snug text-text-subtle">{help}</p> : <div className="mb-3" />}
      {children}
    </section>
  )
}
