import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './core'

/**
 * One-shot codes that move a Google session from Safari into the home-screen
 * PWA. iOS opens Google OAuth in a system sheet where the keyboard often never
 * appears; Safari has a real keyboard, then the user types this code in the app.
 */
export const authHandoffs = pgTable(
  'auth_handoffs',
  {
    code: text('code').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_auth_handoffs_expires').on(t.expiresAt)],
)

export type AuthHandoff = typeof authHandoffs.$inferSelect
