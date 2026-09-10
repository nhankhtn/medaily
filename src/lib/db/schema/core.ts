import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  jsonb,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { localeEnum, themeEnum, unitSystemEnum, weekStartEnum } from './enums'
import type {
  InsightThresholds,
  OnboardingState,
  ScoreTargets,
  ScoreWeights,
  StreakThresholds,
} from '../../types'

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    displayName: text('display_name').notNull().default('Me'),
    email: text('email'),
    imageUrl: text('image_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Case-insensitive and partial: an address identifies at most one person,
    // but the owner row seeded by migration has no email at all.
    uniqueIndex('users_email_uniq')
      .on(sql`lower(${t.email})`)
      .where(sql`${t.email} IS NOT NULL`),
  ],
)

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  locale: localeEnum('locale').notNull().default('en'),
  timezone: text('timezone').notNull().default('Asia/Ho_Chi_Minh'),
  dayRolloverHour: smallint('day_rollover_hour').notNull().default(4),
  weekStart: weekStartEnum('week_start').notNull().default('monday'),
  theme: themeEnum('theme').notNull().default('system'),
  density: text('density').notNull().default('comfortable'),
  accent: text('accent').notNull().default('indigo'),
  unitSystem: unitSystemEnum('unit_system').notNull().default('metric'),
  defaultCurrency: text('default_currency').notNull().default('VND'),
  scoreWeights: jsonb('score_weights').$type<ScoreWeights>(),
  scoreTargets: jsonb('score_targets').$type<ScoreTargets>(),
  streakThresholds: jsonb('streak_thresholds').$type<StreakThresholds>(),
  streakGraceEnabled: boolean('streak_grace_enabled').notNull().default(true),
  insightThresholds: jsonb('insight_thresholds').$type<InsightThresholds>(),
  reminderTime: time('reminder_time').notNull().default('21:00'),
  notificationPrefs: jsonb('notification_prefs').$type<Record<string, boolean>>(),
  dashboardCards: jsonb('dashboard_cards').$type<string[]>(),
  onboarding: jsonb('onboarding').$type<OnboardingState>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const usersRelations = relations(users, ({ one }) => ({
  settings: one(userSettings, { fields: [users.id], references: [userSettings.userId] }),
}))

export type User = typeof users.$inferSelect
export type UserSettingsRow = typeof userSettings.$inferSelect

export const NOW = sql`now()`
