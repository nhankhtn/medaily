'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Field } from '@/features/projects/project-dialog'
import type { ISODate } from '@/lib/dates'
import { saveMeasurement, saveNutrition, saveWorkout } from '@/server/actions/health'

const numberOrNull = (value: FormDataEntryValue | null) => {
  const text = String(value ?? '').trim()
  if (text === '') return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

export function WorkoutDialog({ today }: { today: ISODate }) {
  const t = useTranslations('health')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<{ exercise: string; sets: string; reps: string; weight: string }[]>(
    [],
  )
  const [pending, startTransition] = useTransition()

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveWorkout({
        performedOn: String(formData.get('performedOn') ?? today),
        type: String(formData.get('type') ?? ''),
        durationMinutes: Number(formData.get('durationMinutes') ?? 0),
        distanceKm: numberOrNull(formData.get('distanceKm')),
        calories: numberOrNull(formData.get('calories')),
        rpe: numberOrNull(formData.get('rpe')),
        note: String(formData.get('note') ?? ''),
        sets: rows
          .filter((row) => row.exercise.trim() !== '')
          .map((row) => ({
            exercise: row.exercise.trim(),
            sets: row.sets === '' ? null : Number(row.sets),
            reps: row.reps === '' ? null : Number(row.reps),
            weightKg: row.weight === '' ? null : Number(row.weight),
          })),
      })

      if (!result.ok) {
        toast.error(tc('error'))
        return
      }
      toast.success(t('workoutSaved'))
      if (result.backfilled) toast.info(t('backfilled'))
      setRows([])
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          {t('addWorkout')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('addWorkout')} description={t('noteHint')}>
        <form action={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('type')}>
              <Input name="type" required autoFocus maxLength={80} />
            </Field>
            <Field label={tc('today')}>
              <Input type="date" name="performedOn" max={today} defaultValue={today} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label={t('duration')}>
              <Input
                type="number"
                name="durationMinutes"
                inputMode="numeric"
                min={1}
                max={1440}
                required
                className="text-center tabular-nums"
              />
            </Field>
            <Field label={t('distance')}>
              <Input type="number" name="distanceKm" step="0.1" min={0} className="text-center tabular-nums" />
            </Field>
            <Field label={t('rpe')}>
              <Input type="number" name="rpe" min={1} max={10} className="text-center tabular-nums" />
            </Field>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t('sets')}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRows((prev) => [...prev, { exercise: '', sets: '', reps: '', weight: '' }])}
              >
                <Plus className="size-3.5" />
                {t('addSet')}
              </Button>
            </div>

            {rows.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  className="h-9 flex-1"
                  placeholder={t('exercise')}
                  aria-label={t('exercise')}
                  value={row.exercise}
                  onChange={(event) =>
                    setRows((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, exercise: event.target.value } : item)),
                    )
                  }
                />
                {(['sets', 'reps', 'weight'] as const).map((key) => (
                  <Input
                    key={key}
                    type="number"
                    className="h-9 w-16 text-center tabular-nums"
                    placeholder={t(key === 'weight' ? 'weight' : key === 'sets' ? 'sets' : 'reps')}
                    aria-label={t(key === 'weight' ? 'weight' : key === 'sets' ? 'sets' : 'reps')}
                    value={row[key]}
                    onChange={(event) =>
                      setRows((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, [key]: event.target.value } : item)),
                      )
                    }
                  />
                ))}
                <button
                  type="button"
                  aria-label={tc('delete')}
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                  className="text-text-subtle"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>

          <Field label={tc('none')}>
            <Input name="note" maxLength={500} />
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {tc('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function MeasurementForm({ today }: { today: ISODate }) {
  const t = useTranslations('health')
  const tc = useTranslations('common')
  const [pending, startTransition] = useTransition()

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveMeasurement({
        measuredOn: String(formData.get('measuredOn') ?? today),
        weightKg: numberOrNull(formData.get('weightKg')),
        bodyFatPct: numberOrNull(formData.get('bodyFatPct')),
        waistCm: numberOrNull(formData.get('waistCm')),
        restingHr: numberOrNull(formData.get('restingHr')),
      })
      if (!result.ok) {
        toast.error(tc('error'))
        return
      }
      toast.success(t('measurementSaved'))
    })
  }

  return (
    <form action={submit} className="flex flex-wrap items-end gap-2">
      <label className="w-36 space-y-1.5">
        <span className="text-xs font-medium text-text-muted">{tc('today')}</span>
        <Input type="date" name="measuredOn" max={today} defaultValue={today} />
      </label>
      {(
        [
          ['weightKg', t('weightLabel')],
          ['bodyFatPct', t('bodyFat')],
          ['waistCm', t('waist')],
          ['restingHr', t('restingHr')],
        ] as const
      ).map(([name, label]) => (
        <label key={name} className="w-24 space-y-1.5">
          <span className="text-xs font-medium text-text-muted">{label}</span>
          <Input type="number" step="0.1" name={name} className="text-center tabular-nums" />
        </label>
      ))}
      <Button type="submit" disabled={pending}>
        {tc('save')}
      </Button>
    </form>
  )
}

export function NutritionForm({
  today,
  current,
}: {
  today: ISODate
  current?: { calories: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null; waterMl: number | null }
}) {
  const t = useTranslations('health')
  const tc = useTranslations('common')
  const [pending, startTransition] = useTransition()

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveNutrition({
        logDate: String(formData.get('logDate') ?? today),
        calories: numberOrNull(formData.get('calories')),
        proteinG: numberOrNull(formData.get('proteinG')),
        carbsG: numberOrNull(formData.get('carbsG')),
        fatG: numberOrNull(formData.get('fatG')),
        waterMl: numberOrNull(formData.get('waterMl')),
      })
      if (!result.ok) {
        toast.error(tc('error'))
        return
      }
      toast.success(t('nutritionSaved'))
    })
  }

  return (
    <form action={submit} className="flex flex-wrap items-end gap-2">
      <label className="w-36 space-y-1.5">
        <span className="text-xs font-medium text-text-muted">{tc('today')}</span>
        <Input type="date" name="logDate" max={today} defaultValue={today} />
      </label>
      {(
        [
          ['calories', t('calories'), current?.calories],
          ['proteinG', t('protein'), current?.proteinG],
          ['carbsG', t('carbs'), current?.carbsG],
          ['fatG', t('fat'), current?.fatG],
          ['waterMl', t('water'), current?.waterMl],
        ] as const
      ).map(([name, label, value]) => (
        <label key={name} className="w-24 space-y-1.5">
          <span className="text-xs font-medium text-text-muted">{label}</span>
          <Input
            type="number"
            name={name}
            defaultValue={value ?? ''}
            className="text-center tabular-nums"
          />
        </label>
      ))}
      <Button type="submit" disabled={pending}>
        {t('saveNutrition')}
      </Button>
    </form>
  )
}
