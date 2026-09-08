import { getFormatter, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fromISODate, type ISODate } from '@/lib/dates'
import { getDailyFormData } from '@/server/services/daily'
import { DailyForm } from './daily-form'
import { DateNav } from './date-nav'
import { valuesFromLog } from './types'

/** Shared by `/daily` (today) and `/daily/[date]`. */
export async function DailyPage({ date }: { date: ISODate }) {
  const [t, format, data] = await Promise.all([
    getTranslations('daily'),
    getFormatter(),
    getDailyFormData(date),
  ])

  const isToday = date === data.today

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-text-muted">
            {isToday
              ? t('subtitleToday')
              : t('subtitlePast', {
                  date: format.dateTime(fromISODate(date), {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  }),
                })}
          </p>
        </div>
        <DateNav date={date} today={data.today} />
      </div>

      {data.missingDays.length >= 2 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-border-base bg-accent-soft px-4 py-3">
          <p className="text-sm text-text">
            {t('catchUp.banner', { count: data.missingDays.length })}
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/daily/catch-up">
              {t('catchUp.cta')}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      ) : null}

      <DailyForm
        key={date}
        date={date}
        initialValues={valuesFromLog(data.log)}
        effective={data.effective}
        medians={data.medians}
        exerciseTypes={data.exerciseTypes}
        existed={data.log !== null}
      />
    </div>
  )
}
