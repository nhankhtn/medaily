'use client'

import { useTranslations } from 'next-intl'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Field } from '@/features/projects/project-dialog'
import type { GoalDraft, GoalMetricPlan } from '@/lib/goals/draft'
import {
  GOAL_AGGREGATIONS,
  GOAL_CATEGORIES,
  GOAL_DIRECTIONS,
  GOAL_MODES,
  GOAL_PERIODS,
  GOAL_PRIORITIES,
  type GoalAggregation,
  type GoalCategory,
  type GoalDirection,
  type GoalMode,
  type GoalPeriod,
  type GoalPriority,
} from '@/lib/goals/options'
import { METRIC_KEYS, type MetricKey } from '@/lib/types'

/** What the metric block opens on when the note never described one. */
const FALLBACK_METRIC: GoalMetricPlan = {
  key: 'technical_study_minutes',
  aggregation: 'sum',
  period: 'weekly',
  target: 300,
  direction: 'at_least',
}

/**
 * Everything about a goal except its name, controlled by whoever renders it.
 *
 * The capture list owns the name — it is the row's own heading — so this holds
 * the rest, and a row that turns out to be about something else is edited
 * where it sits rather than in a dialog somewhere else.
 */
export function GoalFields({
  value,
  onChange,
}: {
  value: GoalDraft
  onChange: (next: GoalDraft) => void
}) {
  const t = useTranslations('goals')
  const tm = useTranslations('metricNames')

  const metric = value.metric ?? FALLBACK_METRIC
  const setMetric = (patch: Partial<GoalMetricPlan>) =>
    onChange({ ...value, metric: { ...metric, ...patch } })

  return (
    <div className="space-y-2">
      <Field label={t('description')}>
        <Textarea
          value={value.description ?? ''}
          onChange={(event) => onChange({ ...value, description: event.target.value || null })}
          rows={2}
          maxLength={2000}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t('category')}>
          <Select
            value={value.category}
            onChange={(event) =>
              onChange({ ...value, category: event.target.value as GoalCategory })
            }
          >
            {GOAL_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {t(`categories.${option}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('priority')}>
          <Select
            value={value.priority}
            onChange={(event) =>
              onChange({ ...value, priority: event.target.value as GoalPriority })
            }
          >
            {GOAL_PRIORITIES.map((option) => (
              <option key={option} value={option}>
                {t(`priorities.${option}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t('startDate')}>
          <Input
            type="date"
            value={value.startDate}
            onChange={(event) => onChange({ ...value, startDate: event.target.value })}
          />
        </Field>
        <Field label={t('targetDate')}>
          <Input
            type="date"
            value={value.targetDate ?? ''}
            onChange={(event) => onChange({ ...value, targetDate: event.target.value || null })}
          />
        </Field>
      </div>

      <Field label={t('progressMode')}>
        <Select
          value={value.progressMode}
          onChange={(event) => {
            const progressMode = event.target.value as GoalMode
            // Switching into the metric mode needs a rule to switch into.
            onChange({
              ...value,
              progressMode,
              metric: progressMode === 'metric' ? metric : value.metric,
            })
          }}
        >
          {GOAL_MODES.map((option) => (
            <option key={option} value={option}>
              {t(`modes.${option}`)}
            </option>
          ))}
        </Select>
      </Field>

      {value.progressMode === 'metric' ? (
        <div className="border-border-base bg-surface-2 space-y-2 rounded-[var(--radius)] border p-2">
          <Field label={t('metric')}>
            <Select
              value={metric.key}
              onChange={(event) => setMetric({ key: event.target.value as MetricKey })}
            >
              {METRIC_KEYS.map((key) => (
                <option key={key} value={key}>
                  {tm(key)}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label={t('aggregation')}>
              <Select
                value={metric.aggregation}
                onChange={(event) =>
                  setMetric({ aggregation: event.target.value as GoalAggregation })
                }
              >
                {GOAL_AGGREGATIONS.map((option) => (
                  <option key={option} value={option}>
                    {t(`aggregations.${option}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('period')}>
              <Select
                value={metric.period}
                onChange={(event) => setMetric({ period: event.target.value as GoalPeriod })}
              >
                {GOAL_PERIODS.map((option) => (
                  <option key={option} value={option}>
                    {t(`periods.${option}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('target')}>
              <Input
                type="number"
                step="any"
                min={0}
                value={metric.target}
                onChange={(event) => setMetric({ target: Number(event.target.value) })}
                className="text-center tabular-nums"
              />
            </Field>
            <Field label={t('direction')}>
              <Select
                value={metric.direction}
                onChange={(event) => setMetric({ direction: event.target.value as GoalDirection })}
              >
                {GOAL_DIRECTIONS.map((option) => (
                  <option key={option} value={option}>
                    {t(`directions.${option}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <p className="text-accent text-xs">
            {t('metricPreview', {
              aggregation: t(`aggregations.${metric.aggregation}`),
              metric: tm(metric.key),
              period: t(`periods.${metric.period}`),
              target: metric.target,
            })}
          </p>
        </div>
      ) : value.progressMode === 'milestones' ? (
        <Field label={t('milestones')}>
          <Textarea
            value={value.milestoneTitles.join('\n')}
            onChange={(event) =>
              onChange({
                ...value,
                milestoneTitles: event.target.value.split('\n').map((line) => line.trimStart()),
              })
            }
            rows={4}
            placeholder={t('milestoneHint')}
          />
        </Field>
      ) : null}
    </div>
  )
}
