import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './core'
import {
  accountTypeEnum,
  categoryKindEnum,
  recurrenceRuleEnum,
  transactionKindEnum,
} from './enums-extra'

/** Money is `numeric`, never a float, and always stored positive (spec 12). */
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: accountTypeEnum('type').notNull().default('bank'),
    currency: text('currency').notNull().default('VND'),
    openingBalance: numeric('opening_balance', { precision: 14, scale: 2 }).notNull().default('0'),
    color: text('color'),
    isDemo: boolean('is_demo').notNull().default(false),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_accounts_user').on(t.userId),
    check('currency_code', sql`char_length(${t.currency}) = 3`),
  ],
)

export const financeCategories = pgTable(
  'finance_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: categoryKindEnum('kind').notNull().default('expense'),
    parentId: uuid('parent_id'),
    icon: text('icon'),
    color: text('color'),
    isDemo: boolean('is_demo').notNull().default(false),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_finance_categories_user').on(t.userId, t.kind)],
)

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    occurredOn: date('occurred_on').notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('VND'),
    kind: transactionKindEnum('kind').notNull(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    /** Only for transfers: one row touches both accounts, so income is never inflated. */
    counterAccountId: uuid('counter_account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    fxRate: numeric('fx_rate', { precision: 14, scale: 6 }),
    categoryId: uuid('category_id').references(() => financeCategories.id, {
      onDelete: 'set null',
    }),
    merchant: text('merchant'),
    note: text('note'),
    tags: text('tags').array(),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_transactions_user_date').on(t.userId, t.occurredOn.desc()),
    index('idx_transactions_category').on(t.categoryId, t.occurredOn.desc()),
    check('amount_positive', sql`${t.amount} > 0`),
    check(
      'transfer_has_counter_account',
      sql`${t.kind} <> 'transfer' OR (${t.counterAccountId} IS NOT NULL AND ${t.counterAccountId} <> ${t.accountId})`,
    ),
  ],
)

export const recurringTransactions = pgTable('recurring_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('VND'),
  kind: transactionKindEnum('kind').notNull(),
  accountId: uuid('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').references(() => financeCategories.id, { onDelete: 'set null' }),
  rule: recurrenceRuleEnum('rule').notNull().default('monthly'),
  nextDueOn: date('next_due_on').notNull(),
  endsOn: date('ends_on'),
  note: text('note'),
  isDemo: boolean('is_demo').notNull().default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const budgets = pgTable(
  'budgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => financeCategories.id, { onDelete: 'cascade' }),
    periodStart: date('period_start').notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    rollover: boolean('rollover').notNull().default(false),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('budgets_user_category_period_uniq').on(t.userId, t.categoryId, t.periodStart),
    check('budget_positive', sql`${t.amount} > 0`),
  ],
)

export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /** `asset` adds to net worth, `liability` subtracts from it. */
  kind: text('kind').notNull().default('asset'),
  value: numeric('value', { precision: 14, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('VND'),
  asOf: date('as_of').notNull(),
  note: text('note'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Tracked, never traded (spec 3). Prices are entered by hand, with their date. */
export const investments = pgTable('investments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(),
  name: text('name'),
  quantity: numeric('quantity', { precision: 18, scale: 6 }).notNull(),
  avgCost: numeric('avg_cost', { precision: 14, scale: 2 }).notNull(),
  lastPrice: numeric('last_price', { precision: 14, scale: 2 }),
  pricedAt: date('priced_at'),
  currency: text('currency').notNull().default('VND'),
  note: text('note'),
  isDemo: boolean('is_demo').notNull().default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Account = typeof accounts.$inferSelect
export type FinanceCategory = typeof financeCategories.$inferSelect
export type Transaction = typeof transactions.$inferSelect
export type TransactionInsert = typeof transactions.$inferInsert
export type Budget = typeof budgets.$inferSelect
export type Asset = typeof assets.$inferSelect
export type Investment = typeof investments.$inferSelect
