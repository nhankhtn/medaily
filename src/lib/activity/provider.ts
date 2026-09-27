import { env } from '@/lib/env'
import { mongoActivityStore } from './mongo-store'
import { NO_ACTIVITY, type ActivityStore } from './store'

/**
 * The one line that picks a store.
 *
 * Swapping MongoDB for Postgres is a second file implementing `ActivityStore`
 * and a change here. No service moves and no call site knows the difference —
 * the analytics seam next door is the same shape and has already survived one
 * such swap.
 *
 * Absent `MONGODB_URI` the feature is off: nothing connects, nothing is
 * recorded, the panel does not render, and every screen behaves as if it were
 * never built. Same as the Telegram alerts and the photo uploads.
 *
 * A function rather than a constant, so a test can call it after changing the
 * environment and a serverless instance cannot cache a decision made before
 * its configuration arrived.
 */
export function pickActivityStore(): ActivityStore {
  const uri = env.MONGODB_URI?.trim()
  return uri ? mongoActivityStore(uri) : NO_ACTIVITY
}

/** Whether anything is being recorded — for the panel and the privacy notice. */
export function activityLogEnabled(): boolean {
  return pickActivityStore().id !== NO_ACTIVITY.id
}
