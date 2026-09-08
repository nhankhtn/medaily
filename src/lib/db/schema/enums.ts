import { pgEnum } from 'drizzle-orm/pg-core'

export const localeEnum = pgEnum('locale', ['en', 'vi'])
export const themeEnum = pgEnum('theme', ['light', 'dark', 'system'])
export const weekStartEnum = pgEnum('week_start', ['monday', 'sunday'])
export const unitSystemEnum = pgEnum('unit_system', ['metric', 'imperial'])

export const logSourceEnum = pgEnum('log_source', ['manual', 'catch_up', 'import', 'derived'])

export const habitFrequencyEnum = pgEnum('habit_frequency', [
  'daily',
  'weekly',
  'specific_days',
  'interval',
])
export const habitOperatorEnum = pgEnum('habit_operator', ['gte', 'lte', 'eq'])

export const goalStatusEnum = pgEnum('goal_status', ['active', 'completed', 'paused', 'cancelled'])
export const priorityEnum = pgEnum('priority', ['low', 'medium', 'high'])
export const progressModeEnum = pgEnum('progress_mode', ['manual', 'metric', 'milestones'])
export const metricAggregationEnum = pgEnum('metric_aggregation', [
  'sum',
  'avg',
  'count_days',
  'latest',
])
export const metricPeriodEnum = pgEnum('metric_period', ['total', 'weekly', 'monthly'])
export const metricDirectionEnum = pgEnum('metric_direction', ['at_least', 'at_most'])
export const recurrenceEnum = pgEnum('recurrence', ['weekly', 'monthly', 'quarterly', 'yearly'])

export const focusKindEnum = pgEnum('focus_kind', ['learning', 'deep_work', 'project'])
export const focusSourceEnum = pgEnum('focus_source', ['timer', 'manual'])

export const customMetricTypeEnum = pgEnum('custom_metric_type', [
  'number',
  'boolean',
  'scale',
  'text',
])

export const insightSeverityEnum = pgEnum('insight_severity', ['low', 'medium', 'high', 'win'])
