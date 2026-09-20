'use client'

import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { fromISODate, type ISODate } from '@/lib/dates'
import { PATHS } from '@/lib/paths'
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
export function CatchUpGrid({
  dates,
  hiddenFields,
}: {
  dates: ISODate[]
  hiddenFields: readonly string[]
}) {
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

  /*
   * These rows start empty by definition — they are the days nobody logged —
   * so a column switched off has nothing to protect and simply goes. Header
   * and cell ask the same question, which is what keeps them in step.
   */
  const show = (field: keyof Row) => !hiddenFields.includes(field)

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
      router.push(PATHS.home)
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-text-muted text-sm">{t('body')}</p>

      <Card>
        <CardBody className="p-0 sm:px-4 sm:pb-4">
          <div className="overflow-x-auto px-4 pb-4 sm:px-0 sm:pb-0">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-text-subtle text-left text-xs">
                  <th className="pb-2 font-normal">{tc('today')}</th>
                  {show('energy') ? <th className="pb-2 font-normal">{tf('energy')}</th> : null}
                  {show('sleepHours') ? <th className="pb-2 font-normal">{tf('sleepHours')}</th> : null}
                  {show('technicalStudyMinutes') ? (
                    <th className="pb-2 font-normal">{tf('technicalStudy')}</th>
                  ) : null}
                  {show('entertainmentMinutes') ? (
                    <th className="pb-2 font-normal">{tf('entertainment')}</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.date} className="border-border-base border-t">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className="text-sm font-medium">
                        {format.dateTime(fromISODate(row.date), 'weekdayDayMonth')}
                      </span>
                    </td>
                    {show('energy') ? (
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
                    ) : null}
                    {show('sleepHours') ? (
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
                              sleepHours:
                                event.target.value === '' ? null : Number(event.target.value),
                            })
                          }
                        />
                      </td>
                    ) : null}
                    {show('technicalStudyMinutes') ? (
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
                    ) : null}
                    {show('entertainmentMinutes') ? (
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
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <div className={cn('flex gap-2', filled.length === 0 && 'opacity-60')}>
        <Button onClick={submit} disabled={pending || filled.length === 0}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {t('saveAll', { count: filled.length })}
        </Button>
      </div>
    </div>
  )
}
