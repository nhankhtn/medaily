'use client'

import { ArrowRight, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { ScaleInput } from '@/components/ui/scale-input'
import { Stepper } from '@/components/ui/stepper'
import type { ISODate } from '@/lib/dates'
import { PATHS } from '@/lib/paths'
import { cn } from '@/lib/utils'
import { saveDay } from '@/server/actions/daily'
import { queuePendingSave } from '@/features/daily/pending-saves'

/**
 * Spec 6.4 — when today is unlogged, the dashboard offers energy and sleep
 * inline. Two taps create the row; the rest of the day can be filled in later.
 *
 * Offline uses the same day queue as the full form: a catch means the action
 * never reached the server, and `saveDay` upserts so a replay is safe.
 */
export function QuickLog({ date }: { date: ISODate }) {
  const t = useTranslations('daily.quickLog')
  const to = useTranslations('daily.offline')
  const tc = useTranslations('common')
  const td = useTranslations('daily.fields')
  const [energy, setEnergy] = useState<number | null>(null)
  const [sleepHours, setSleepHours] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = () => {
    startTransition(async () => {
      const patch = { energy, sleepHours }

      try {
        const result = await saveDay({ date, patch, source: 'manual' })
        if (!result.ok) {
          toast.error(tc('error'))
          return
        }
        toast.success(tc('saved'))
        setEnergy(null)
        setSleepHours(null)
      } catch (error) {
        console.error('[home] quick log did not reach the server:', error)
        try {
          await queuePendingSave({ date, patch, custom: {} })
        } catch (kept) {
          console.error('[offline] could not keep the quick log on this device:', kept)
          toast.error(to('notKept'))
          return
        }
        toast.success(to('queued'))
        setEnergy(null)
        setSleepHours(null)
      }
    })
  }

  return (
    <div className="space-y-3 px-4 pb-4">
      <p className="text-sm text-text-muted">{t('body')}</p>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-text-muted">{td('energy')}</span>
        <ScaleInput name={td('energy')} value={energy} onChange={setEnergy} />
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-text-muted">{td('sleepHours')}</span>
        <Stepper
          name={td('sleepHours')}
          value={sleepHours}
          onChange={setSleepHours}
          suffix={tc('hoursShort')}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={submit} disabled={pending || (energy === null && sleepHours === null)}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {t('cta')}
        </Button>
        <Link href={PATHS.daily} className={cn(buttonVariants({ variant: 'outline' }))}>
          {t('full')}
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  )
}
