'use client'

import { Settings2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import type { CustomMetric } from '@/lib/db/schema'
import type { MetricUse } from '@/server/services/metric-uses'
import { CustomMetricsEditor } from './custom-metrics-editor'
import { DailyFieldsEditor } from './daily-fields-editor'

/**
 * What this form asks, and what else it could ask.
 *
 * Both of these used to live on the settings page, where nobody found them —
 * the moment you want one is the moment you are looking at the form, either
 * because it asks something you never answer or because it does not ask the
 * one thing you want to track.
 */
export function DailySettingsDialog({
  hidden,
  uses,
  metrics,
}: {
  hidden: string[]
  uses: MetricUse
  metrics: CustomMetric[]
}) {
  const t = useTranslations('daily.setup')
  const tf = useTranslations('settings.dailyFields')
  const tm = useTranslations('settings.metrics')
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={t('title')}>
          <Settings2 className="size-4" />
          <span className="max-sm:sr-only">{t('title')}</span>
        </Button>
      </DialogTrigger>

      <DialogContent title={t('title')}>
        <div className="space-y-6">
          {/* Adding first, and it is the shorter of the two: the field list
              runs to a dozen rows, so putting it above would push the thing
              somebody came here to find below the fold. */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{tm('title')}</h3>
            <CustomMetricsEditor metrics={metrics} />
          </div>

          <div className="border-border-base space-y-2 border-t pt-5">
            <h3 className="text-sm font-semibold">{tf('title')}</h3>
            <DailyFieldsEditor hidden={hidden} uses={uses} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
