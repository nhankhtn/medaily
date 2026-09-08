'use client'

import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fromISODate, type ISODate } from '@/lib/dates'
import { saveCatchUp } from '@/server/actions/daily'
import { cn } from '@/lib/utils'

type Row = {
  date: ISODate
  energy: number | null
  sleepHours: number | null
  technicalStudyMinutes: number | null
  entertainmentMinutes: number | null
}

/**
 * Spec 6.4 — one row per missing day, four fields wide, saved in one action.
 * Backfilling a week should not mean opening seven screens.
 */
export function CatchUpGrid({ dates }: { dates: ISODate[] }) {
  const t = useTranslations('daily.catchUp')
  const tf = useTranslations('daily.fields')
  const tc = useTranslations('common')
  const format = useFormatter()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [rows, setRows] = useState<Row[]>(
    dates.map((date) => ({
      date,
      energy: null,
      sleepHours: null,
      technicalStudyMinutes: null,
      entertainmentMinutes: null,
    })),
  )

  const update = (date: ISODate, patch: Partial<Row>) =>
    setRows((prev) => prev.map((row) => (row.date === date ? { ...row, ...patch } : row)))

  const filled = rows.filter(
    (row) =>
      row.energy !== null ||
      row.sleepHours !== null ||
      row.technicalStudyMinutes !== null ||
      row.entertainmentMinutes !== null,
  )

  const submit = () => {
    startTransition(async () => {
      const result = await saveCatchUp({
        rows: filled.map((row) => ({
          date: row.date,
          patch: {
            energy: row.energy,
            sleepHours: row.sleepHours,
            technicalStudyMinutes: row.technicalStudyMinutes,
            entertainmentMinutes: row.entertainmentMinutes,
          },
        })),
      })

      if (!result.ok) {
        toast.error(tc('error'))
        return
      }
      toast.success(t('savedToast', { count: result.count }))
      router.push('/')
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">{t('body')}</p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs text-text-subtle">
              <th className="pb-2 font-normal">{tc('today')}</th>
              <th className="pb-2 font-normal">{tf('energy')}</th>
              <th className="pb-2 font-normal">{tf('sleepHours')}</th>
              <th className="pb-2 font-normal">{tf('technicalStudy')}</th>
              <th className="pb-2 font-normal">{tf('entertainment')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date} className="border-t border-border-base">
                <td className="py-2 pr-3 whitespace-nowrap">
                  <span className="text-sm font-medium">
                    {format.dateTime(fromISODate(row.date), {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </td>
                <td className="py-2 pr-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={10}
                    aria-label={`${tf('energy')} ${row.date}`}
                    className="h-9 w-16 text-center tabular-nums"
                    value={row.energy ?? ''}
                    onChange={(event) =>
                      update(row.date, {
                        energy: event.target.value === '' ? null : Number(event.target.value),
                      })
                    }
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step={0.5}
                    min={0}
                    max={24}
                    aria-label={`${tf('sleepHours')} ${row.date}`}
                    className="h-9 w-20 text-center tabular-nums"
                    value={row.sleepHours ?? ''}
                    onChange={(event) =>
                      update(row.date, {
                        sleepHours: event.target.value === '' ? null : Number(event.target.value),
                      })
                    }
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={1440}
                    step={5}
                    aria-label={`${tf('technicalStudy')} ${row.date}`}
                    className="h-9 w-20 text-center tabular-nums"
                    value={row.technicalStudyMinutes ?? ''}
                    onChange={(event) =>
                      update(row.date, {
                        technicalStudyMinutes:
                          event.target.value === '' ? null : Number(event.target.value),
                      })
                    }
                  />
                </td>
                <td className="py-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={1440}
                    step={5}
                    aria-label={`${tf('entertainment')} ${row.date}`}
                    className="h-9 w-20 text-center tabular-nums"
                    value={row.entertainmentMinutes ?? ''}
                    onChange={(event) =>
                      update(row.date, {
                        entertainmentMinutes:
                          event.target.value === '' ? null : Number(event.target.value),
                      })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={cn('flex gap-2', filled.length === 0 && 'opacity-60')}>
        <Button onClick={submit} disabled={pending || filled.length === 0}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {t('saveAll', { count: filled.length })}
        </Button>
      </div>
    </div>
  )
}
