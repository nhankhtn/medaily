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

/**
 * Where a person's notifications can reach them.
 *
 * One row per browser that asked for them — a phone and a laptop are two, and
 * the same phone reinstalling the app is a third until the old token is
 * refused and swept. The token is the address, so it is the key: FCM hands the
 * same string back to whoever registers the same browser, and a unique index
 * on it is what stops two rows claiming one device after a sign-out and a
 * sign-in by somebody else.
 *
 * Here rather than beside the chat it serves, because this is where accounts
 * live: the cascade means deleting a person takes their devices with them,
 * which is one fewer thing for the account-removal path to remember.
 */
export const pushDevices = pgTable(
  'push_devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The FCM registration token. Long, opaque, and rotated by the browser. */
    token: text('token').notNull(),
    /** Only to tell one row from another in settings; never trusted for anything. */
    userAgent: text('user_agent'),
    /** Moved forward every time the browser confirms the token still works. */
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('push_devices_token_uniq').on(t.token),
    index('idx_push_devices_user').on(t.userId),
  ],
)

export const pushDevicesRelations = relations(pushDevices, ({ one }) => ({
  user: one(users, { fields: [pushDevices.userId], references: [users.id] }),
}))

export type PushDevice = typeof pushDevices.$inferSelect
