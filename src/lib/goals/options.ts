/**
 * The closed sets a goal's columns accept, in one place: the dialog builds its
 * selects from them and the capture draft validates a model's answer against
 * them, so neither can drift from the other or from the CHECK constraints.
 */
export const GOAL_CATEGORIES = ['career', 'health', 'finance', 'knowledge', 'life'] as const
export const GOAL_PRIORITIES = ['low', 'medium', 'high'] as const
export const GOAL_MODES = ['manual', 'metric', 'milestones'] as const
export const GOAL_AGGREGATIONS = ['sum', 'avg', 'count_days', 'latest'] as const
export const GOAL_PERIODS = ['total', 'weekly', 'monthly'] as const
export const GOAL_DIRECTIONS = ['at_least', 'at_most'] as const

export type GoalCategory = (typeof GOAL_CATEGORIES)[number]
export type GoalPriority = (typeof GOAL_PRIORITIES)[number]
export type GoalMode = (typeof GOAL_MODES)[number]
export type GoalAggregation = (typeof GOAL_AGGREGATIONS)[number]
export type GoalPeriod = (typeof GOAL_PERIODS)[number]
export type GoalDirection = (typeof GOAL_DIRECTIONS)[number]
