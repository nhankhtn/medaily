'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { MinuteInput } from '@/components/ui/minute-input'
import { ScaleInput } from '@/components/ui/scale-input'
import { Stepper } from '@/components/ui/stepper'
import type { CustomMetric } from '@/lib/db/schema'
import { Field, FormSection } from './section'

export type CustomValues = Record<string, number | boolean | string | null>

/**
 * The activities the user added themselves, rendered from their own
 * definitions rather than from columns. A `number` metric gets a stepper, a
 * `scale` the same 1–10 bar the built-in ones use, and so on.
 */
export function CustomFields({
  metrics,
  values,
  onChange,
}: {
  metrics: CustomMetric[]
  values: CustomValues
  onChange: (id: string, value: number | boolean | string | null) => void
}) {
  const t = useTranslations('daily')
  const locale = useLocale()
  if (metrics.length === 0) return null

  const filled = metrics.filter((metric) => {
    const value = values[metric.id]
    return value !== null && value !== undefined && value !== ''
  }).length

  return (
    <FormSection title={t('sections.custom')} filled={filled} total={metrics.length}>
      {metrics.map((metric) => {
        const label = locale === 'vi' ? metric.labelVi : metric.labelEn
        const value = values[metric.id] ?? null

        return (
          <Field key={metric.id} label={label} hint={metric.unit ?? undefined}>
            {metric.type === 'duration' ? (
              <MinuteInput
                name={label}
                value={typeof value === 'number' ? value : null}
                onChange={(next) => onChange(metric.id, next)}
              />
            ) : metric.type === 'scale' ? (
              <ScaleInput
                name={label}
                value={typeof value === 'number' ? value : null}
                onChange={(next) => onChange(metric.id, next)}
              />
            ) : metric.type === 'boolean' ? (
              <button
                type="button"
                onClick={() => onChange(metric.id, value === true ? null : true)}
                aria-pressed={value === true}
                className={
                  value === true
                    ? 'border-accent bg-accent-soft text-accent h-11 rounded-[var(--radius)] border px-4 text-sm font-medium'
                    : 'border-border-strong bg-surface text-text-muted h-11 rounded-[var(--radius)] border px-4 text-sm'
                }
              >
                {value === true ? t('customDone') : t('customNotDone')}
              </button>
            ) : metric.type === 'text' ? (
              <Input
                value={typeof value === 'string' ? value : ''}
                maxLength={500}
                onChange={(event) => onChange(metric.id, event.target.value || null)}
              />
            ) : (
              <Stepper
                name={label}
                value={typeof value === 'number' ? value : null}
                min={metric.min === null ? 0 : Number(metric.min)}
                max={metric.max === null ? 100_000 : Number(metric.max)}
                onChange={(next) => onChange(metric.id, next)}
                suffix={metric.unit ?? undefined}
              />
            )}
          </Field>
        )
      })}
    </FormSection>
  )
}
