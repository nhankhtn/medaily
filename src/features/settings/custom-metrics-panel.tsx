'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Field } from '@/features/projects/project-dialog'
import type { CustomMetric } from '@/lib/db/schema'
import { metricKeyFrom } from '@/lib/metrics/key'
import { METRIC_KEYS } from '@/lib/types'
import { archiveCustomMetric, saveCustomMetric } from '@/server/actions/custom-metrics'

const TYPES = ['number', 'duration', 'scale', 'boolean', 'text'] as const
const AGGREGATIONS = ['sum', 'avg', 'count_days', 'latest'] as const

/**
 * The daily log ships with the metrics most people want; this is where the
 * rest come from. A metric added here appears on the daily log, and a habit or
 * a goal can bind to it exactly like a built-in one.
 */
export function CustomMetricsPanel({ metrics }: { metrics: CustomMetric[] }) {
  const t = useTranslations('settings.metrics')
  const locale = useLocale()
  const [pending, startTransition] = useTransition()

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{t('title')}</h2>
          <p className="text-text-subtle mt-0.5 text-xs leading-snug">{t('help')}</p>
        </div>
        <MetricDialog taken={metrics.map((m) => m.key)} />
      </div>

      {metrics.length === 0 ? (
        <p className="text-text-subtle mt-3 text-sm">{t('none')}</p>
      ) : (
        <ul className="divide-border-base mt-3 divide-y">
          {metrics.map((metric) => (
            <li key={metric.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <span className="truncate text-sm">
                  {locale === 'vi' ? metric.labelVi : metric.labelEn}
                </span>
                <span className="text-text-subtle ml-2 text-xs">
                  {metric.key}
                  {metric.unit ? ` · ${metric.unit}` : ''}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <MetricDialog metric={metric} taken={metrics.map((m) => m.key)} />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  aria-label={t('archive')}
                  title={t('archive')}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await archiveCustomMetric({ id: metric.id })
                      toast[result.ok ? 'success' : 'error'](
                        result.ok ? t('archived') : t('failed'),
                      )
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function MetricDialog({ metric, taken }: { metric?: CustomMetric; taken: string[] }) {
  const t = useTranslations('settings.metrics')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const [labelEn, setLabelEn] = useState(metric?.labelEn ?? '')
  const [key, setKey] = useState(metric?.key ?? '')
  // Once the key is edited by hand it stops following the name, or a later
  // rename would move a binding the user did not ask to move.
  const [keyEdited, setKeyEdited] = useState(metric !== undefined)

  const clash =
    key.length > 0 &&
    ((METRIC_KEYS as readonly string[]).includes(key)
      ? 'key_reserved'
      : taken.includes(key) && key !== metric?.key
        ? 'key_taken'
        : null)

  const submit = (formData: FormData) =>
    startTransition(async () => {
      const number = (name: string) => {
        const raw = String(formData.get(name) ?? '').trim()
        return raw === '' ? null : Number(raw)
      }

      const result = await saveCustomMetric({
        id: metric?.id,
        key: String(formData.get('key') ?? '').trim(),
        labelEn: String(formData.get('labelEn') ?? '').trim(),
        labelVi: String(formData.get('labelVi') ?? '').trim(),
        type: formData.get('type'),
        unit: String(formData.get('unit') ?? '').trim() || null,
        min: number('min'),
        max: number('max'),
        aggregation: formData.get('aggregation'),
      })

      if (result.ok) {
        toast.success(t('saved'))
        setOpen(false)
        return
      }
      toast.error(
        t(
          result.error === 'key_taken' || result.error === 'key_reserved' ? result.error : 'failed',
        ),
      )
    })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={metric ? 'ghost' : 'outline'} size="sm">
          {metric ? tc('edit') : <Plus className="size-4" />}
          {metric ? null : t('add')}
        </Button>
      </DialogTrigger>
      <DialogContent title={metric ? t('edit') : t('add')} description={t('keyHelp')}>
        <form action={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('labelVi')}>
              <Input
                name="labelVi"
                defaultValue={metric?.labelVi}
                required
                maxLength={60}
                autoFocus
              />
            </Field>
            <Field label={t('labelEn')}>
              <Input
                name="labelEn"
                value={labelEn}
                required
                maxLength={60}
                onChange={(event) => {
                  setLabelEn(event.target.value)
                  if (!keyEdited) setKey(metricKeyFrom(event.target.value))
                }}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('key')}>
              <Input
                name="key"
                value={key}
                required
                maxLength={40}
                pattern="[a-z][a-z0-9_]*"
                aria-invalid={clash !== null}
                onChange={(event) => {
                  setKeyEdited(true)
                  setKey(event.target.value)
                }}
              />
              {clash ? <p className="text-bad mt-1 text-xs">{t(clash)}</p> : null}
            </Field>
            <Field label={t('unit')}>
              <Input name="unit" defaultValue={metric?.unit ?? ''} maxLength={20} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('type')}>
              <Select name="type" defaultValue={metric?.type ?? 'number'}>
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`types.${type}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('aggregation')}>
              <Select name="aggregation" defaultValue={metric?.aggregation ?? 'sum'}>
                {AGGREGATIONS.map((aggregation) => (
                  <option key={aggregation} value={aggregation}>
                    {t(`aggregations.${aggregation}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('min')}>
              <Input name="min" type="number" step="any" defaultValue={metric?.min ?? ''} />
            </Field>
            <Field label={t('max')}>
              <Input name="max" type="number" step="any" defaultValue={metric?.max ?? ''} />
            </Field>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={pending || clash !== null}>
              {tc('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
