import { getFormatter, getTranslations } from 'next-intl/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { PageHeader, StatRow } from '@/components/ui/page'
import { MeasurementForm, NutritionForm, WorkoutDialog } from '@/features/health/health-forms'
import { WeightChart } from '@/features/health/weight-chart'
import { fromISODate } from '@/lib/dates'
import { getHealthData } from '@/server/services/health'

export default async function HealthPage() {
  const [t, format, data] = await Promise.all([
    getTranslations('health'),
    getFormatter(),
    getHealthData(),
  ])

  const todayNutrition = data.nutrition.find((row) => row.logDate === data.today)

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('title')}
        action={<WorkoutDialog today={data.today} />}
      />

      <StatRow
        items={[
          { label: t('workoutCount'), value: String(data.totals.workoutCount), hint: t('thisRange') },
          {
            label: t('totalMinutes'),
            value: `${Math.floor(data.totals.minutes / 60)}h ${data.totals.minutes % 60}m`,
          },
          {
            label: t('latestWeight'),
            value: data.totals.latestWeight === null ? '—' : `${data.totals.latestWeight} kg`,
          },
          { label: t('measurements'), value: String(data.measurements.length) },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('measurements')} />
          <CardBody className="space-y-4">
            <MeasurementForm today={data.today} />
            <WeightChart points={data.weightSeries} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('nutrition')} />
          <CardBody className="space-y-4">
            <NutritionForm today={data.today} current={todayNutrition} />
            {data.nutrition.length > 0 ? (
              <ul className="divide-y divide-border-base text-sm">
                {data.nutrition.slice(0, 7).map((row) => (
                  <li key={row.id} className="flex items-center gap-3 py-1.5">
                    <span className="w-20 shrink-0 text-xs tabular-nums text-text-subtle">
                      {format.dateTime(fromISODate(row.logDate), { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="tabular-nums">{row.calories ?? '—'} kcal</span>
                    <span className="text-text-subtle tabular-nums">
                      {row.proteinG ?? '—'}p · {row.carbsG ?? '—'}c · {row.fatG ?? '—'}f
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={t('workouts')} />
        <CardBody>
          {data.workouts.length === 0 ? (
            <p className="text-sm text-text-subtle">{t('noWorkouts')}</p>
          ) : (
            <ul className="divide-y divide-border-base">
              {data.workouts.map((workout) => (
                <li key={workout.id} className="py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{workout.type}</span>
                    <Badge tone="accent">{workout.durationMinutes}m</Badge>
                    {workout.distanceKm ? <Badge>{Number(workout.distanceKm)} km</Badge> : null}
                    {workout.rpe ? <Badge tone="warn">RPE {workout.rpe}</Badge> : null}
                    <span className="ml-auto text-xs tabular-nums text-text-subtle">
                      {format.dateTime(fromISODate(workout.performedOn), {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                  {workout.sets.length > 0 ? (
                    <p className="mt-1 text-xs text-text-subtle">
                      {workout.sets
                        .map(
                          (set) =>
                            `${set.exercise} ${set.sets ?? ''}×${set.reps ?? ''}${
                              set.weightKg ? ` @${Number(set.weightKg)}kg` : ''
                            }`,
                        )
                        .join(' · ')}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
