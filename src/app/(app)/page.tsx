import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { getFormatter, getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { GoalList } from '@/features/dashboard/goal-list'
import { HabitRow } from '@/features/dashboard/habit-row'
import { InsightList } from '@/features/dashboard/insight-list'
import { QuickLog } from '@/features/dashboard/quick-log'
import { ScoreCard } from '@/features/dashboard/score-card'
import { StatTile } from '@/features/dashboard/stat-tile'
import { StreakStrip } from '@/features/dashboard/streak-strip'
import { Trends } from '@/features/dashboard/trends'
import { GettingStarted } from '@/features/onboarding/getting-started'
import { WelcomeTour } from '@/features/onboarding/welcome-tour'
import { fromISODate } from '@/lib/dates'
import { getDashboardData } from '@/server/services/dashboard'
import { getOnboardingView } from '@/server/services/onboarding'

export default async function DashboardPage() {
  const [t, tc, tm, format, data, onboarding] = await Promise.all([
    getTranslations('dashboard'),
    getTranslations('common'),
    getTranslations('metrics'),
    getFormatter(),
    getDashboardData(),
    getOnboardingView(),
  ])

  const { todayCard, weekTotals, previousWeekTotals } = data
  const log = todayCard.log
  const previous = todayCard.previous

  const delta = (current: number | null, before: number | null) =>
    current === null || before === null ? null : Math.round((current - before) * 10) / 10

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-text-muted">
          {format.dateTime(fromISODate(data.today), {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
      </div>

      <WelcomeTour open={onboarding.openTour} />

      {onboarding.showChecklist ? <GettingStarted checklist={onboarding.checklist} /> : null}

      {/* 1. Today — an unlogged day gets the two-tap quick log instead of tiles */}
      {todayCard.logged ? (
        <>
          <ScoreCard dayScore={todayCard.score} weekScore={data.weekScore} />

          <Card>
            <CardHeader
              title={t('todayCard')}
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/daily">
                    {tc('edit')}
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              }
            />
            <CardBody className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <StatTile
                label={tm('energy')}
                value={log?.energy ?? null}
                delta={delta(log?.energy ?? null, previous?.energy ?? null)}
                deltaLabel={t('vsYesterday')}
                emptyLabel={tc('notLogged')}
              />
              <StatTile
                label={tm('sleep')}
                value={log?.sleepHours ?? null}
                unit={tc('hoursShort')}
                delta={delta(log?.sleepHours ?? null, previous?.sleepHours ?? null)}
                emptyLabel={tc('notLogged')}
              />
              <StatTile
                label={tm('study')}
                value={log?.effectiveStudyMinutes ?? null}
                unit={tc('min')}
                delta={delta(
                  log?.effectiveStudyMinutes ?? null,
                  previous?.effectiveStudyMinutes ?? null,
                )}
                emptyLabel={tc('notLogged')}
              />
              <StatTile
                label={tm('deepWork')}
                value={log?.effectiveDeepWorkMinutes ?? null}
                unit={tc('min')}
                emptyLabel={tc('notLogged')}
              />
              <StatTile
                label={tm('exercise')}
                value={log?.exerciseMinutes ?? null}
                unit={tc('min')}
                emptyLabel={tc('notLogged')}
              />
              <StatTile
                label={tm('entertainment')}
                value={log?.entertainmentMinutes ?? null}
                unit={tc('min')}
                higherIsBetter={false}
                delta={delta(
                  log?.entertainmentMinutes ?? null,
                  previous?.entertainmentMinutes ?? null,
                )}
                emptyLabel={tc('notLogged')}
              />
            </CardBody>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader title={t('todayCard')} />
          <QuickLog date={data.today} />
        </Card>
      )}

      {/* 2. This week */}
      <Card>
        <CardHeader title={t('weekCard')} />
        <CardBody className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile
            label={tm('focus')}
            value={weekTotals.totalStudyMinutes + weekTotals.totalDeepWorkMinutes}
            unit={tc('min')}
            delta={
              previousWeekTotals.daysLogged > 0
                ? weekTotals.totalStudyMinutes +
                  weekTotals.totalDeepWorkMinutes -
                  (previousWeekTotals.totalStudyMinutes + previousWeekTotals.totalDeepWorkMinutes)
                : null
            }
            deltaLabel={t('vsLastWeek')}
            emptyLabel={tc('notLogged')}
          />
          <StatTile
            label={tm('sleep')}
            value={weekTotals.avgSleepHours}
            unit={tc('hoursShort')}
            delta={delta(weekTotals.avgSleepHours, previousWeekTotals.avgSleepHours)}
            deltaLabel={t('vsLastWeek')}
            emptyLabel={tc('notLogged')}
          />
          <StatTile
            label={tm('energy')}
            value={weekTotals.avgEnergy === null ? null : Math.round(weekTotals.avgEnergy * 10) / 10}
            delta={delta(weekTotals.avgEnergy, previousWeekTotals.avgEnergy)}
            deltaLabel={t('vsLastWeek')}
            emptyLabel={tc('notLogged')}
          />
          <StatTile
            label={tm('exercise')}
            value={weekTotals.exerciseDays}
            unit={tc('days')}
            delta={weekTotals.exerciseDays - previousWeekTotals.exerciseDays}
            deltaLabel={t('vsLastWeek')}
            emptyLabel={tc('notLogged')}
          />
          <StatTile
            label={tm('entertainment')}
            value={weekTotals.totalEntertainmentMinutes}
            unit={tc('min')}
            higherIsBetter={false}
            delta={
              weekTotals.totalEntertainmentMinutes - previousWeekTotals.totalEntertainmentMinutes
            }
            deltaLabel={t('vsLastWeek')}
            emptyLabel={tc('notLogged')}
          />
        </CardBody>
      </Card>

      {/* 3. Streaks */}
      <Card>
        <CardHeader title={t('streaksCard')} />
        <StreakStrip streaks={data.streaks} />
      </Card>

      {/* 4. Insights */}
      <Card>
        <CardHeader title={t('insightsCard')} />
        <InsightList insights={data.insights} />
      </Card>

      {/* 5. Trends */}
      <Card>
        <CardHeader title={t('trendsCard')} />
        <Trends points={data.trends} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 6. Goals */}
        <Card>
          <CardHeader
            title={t('goalsCard')}
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/goals">{t('seeAll')}</Link>
              </Button>
            }
          />
          <GoalList goals={data.goals} />
        </Card>

        {/* 7. Habits */}
        <Card>
          <CardHeader
            title={t('habitsCard')}
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/habits">{t('seeAll')}</Link>
              </Button>
            }
          />
          <HabitRow habits={data.habits} date={data.today} />
        </Card>
      </div>
    </div>
  )
}
