import { pgEnum } from 'drizzle-orm/pg-core'

/** Enums for the modules added after the core loop. */
export const projectStatusEnum = pgEnum('project_status', [
  'planned',
  'active',
  'on_hold',
  'done',
  'dropped',
])
export const taskStatusEnum = pgEnum('task_status', ['todo', 'doing', 'blocked', 'done'])

export const resourceTypeEnum = pgEnum('resource_type', [
  'book',
  'course',
  'article',
  'video',
  'other',
])
export const resourceStatusEnum = pgEnum('resource_status', [
  'backlog',
  'in_progress',
  'done',
  'dropped',
])

export const accountTypeEnum = pgEnum('account_type', [
  'cash',
  'bank',
  'credit_card',
  'e_wallet',
  'investment',
  'loan',
])
export const categoryKindEnum = pgEnum('category_kind', ['income', 'expense'])
export const transactionKindEnum = pgEnum('transaction_kind', ['income', 'expense', 'transfer'])
export const recurrenceRuleEnum = pgEnum('recurrence_rule', [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
])

export const noteTypeEnum = pgEnum('note_type', ['note', 'concept', 'bookmark'])

export const blockKindEnum = pgEnum('block_kind', [
  'learning',
  'deep_work',
  'project',
  'exercise',
  'other',
])

export const relationshipEnum = pgEnum('relationship', [
  'family',
  'friend',
  'colleague',
  'mentor',
  'other',
  // Appended rather than inserted: Postgres enums keep their declared order,
  // and reordering an existing type would rewrite every dependent row.
  'partner',
])
export const interactionChannelEnum = pgEnum('interaction_channel', [
  'in_person',
  'call',
  'message',
  'email',
  'other',
])

export const aiReportKindEnum = pgEnum('ai_report_kind', ['weekly', 'monthly', 'question'])
