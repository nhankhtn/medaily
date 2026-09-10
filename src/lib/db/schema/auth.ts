import { relations } from 'drizzle-orm'
import { index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { users } from './core'
import { authProviderEnum } from './enums-extra'

/**
 * How a person proves who they are. One row per (provider, account); several
 * rows may point at the same user, so signing in with Google and with the env
 * credential pair lands in the same workspace rather than two.
 *
 * The uniqueness of `(provider, provider_uid)` is what makes a duplicate
 * account impossible — two concurrent first sign-ins race into the same
 * constraint and one of them loses, instead of both creating a user.
 */
export const authIdentities = pgTable(
  'auth_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: authProviderEnum('provider').notNull(),
    /** Firebase `uid` for Google; the configured username for `password`. */
    providerUid: text('provider_uid').notNull(),
    /** Denormalized for support and for matching an invite; never the key. */
    email: text('email'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('auth_identities_provider_uid_uniq').on(t.provider, t.providerUid),
    index('idx_auth_identities_user').on(t.userId),
  ],
)

export const authIdentitiesRelations = relations(authIdentities, ({ one }) => ({
  user: one(users, { fields: [authIdentities.userId], references: [users.id] }),
}))

export type AuthIdentity = typeof authIdentities.$inferSelect
export type AuthIdentityInsert = typeof authIdentities.$inferInsert
