/**
 * Client-safe constants. The analytics service imports the database, so a
 * client component must never import from it — even for a constant, since that
 * would drag the driver into the browser bundle.
 */
export const ANALYTICS_RANGES = [7, 30, 90, 365] as const
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number]
