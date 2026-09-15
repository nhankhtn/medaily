import type { ISODate } from '@/lib/dates'

/**
 * Every URL the app knows, in one place. Nothing else should spell a route out:
 * renaming a page is then one edit here plus moving its folder, and a typo
 * becomes a type error instead of a dead link.
 *
 * The convention is plain strings for pages that take nothing, and functions
 * for the ones that take an id or a query. Keep this file free of runtime
 * imports — the proxy pulls it in on the edge runtime.
 */

export type CalendarView = 'day' | 'week' | 'month' | 'year'

export const PATHS = {
  home: '/',
  login: '/login',

  daily: '/daily',
  dailyOn: (date: ISODate) => `/daily/${date}`,
  catchUp: '/daily/catch-up',

  habits: '/habits',
  goals: '/goals',

  projects: '/projects',
  project: (id: string) => `/projects/${id}`,

  learning: '/learning',
  timer: '/timer',
  health: '/health',
  finance: '/finance',
  journal: '/journal',
  /** The journal with one entry opened. */
  journalEntry: (id: string) => `/journal?entry=${id}`,

  knowledge: '/knowledge',
  /** The knowledge page with one note opened. */
  note: (id: string) => `/knowledge?note=${id}`,

  calendar: (options?: { view?: CalendarView; at?: ISODate }) => {
    const query = new URLSearchParams()
    if (options?.view) query.set('view', options.view)
    if (options?.at) query.set('at', options.at)
    const search = query.toString()
    return search ? `/calendar?${search}` : '/calendar'
  },

  people: '/people',
  career: '/career',

  analytics: '/analytics',
  reviews: '/reviews',
  settings: '/settings',

  manifest: '/manifest.webmanifest',

  firebaseAuthHandler: '/__/auth',

  api: {
    health: '/api/health',
    googleAuth: '/api/auth/google',
    calendarIcs: '/api/calendar.ics',
    exportJson: '/api/export?format=json',
    exportCsv: (table: string) => `/api/export?format=csv&table=${table}`,
  },
} as const

/** Every page with a fixed address, for the smoke test and the nav registry. */
export const STATIC_PAGE_PATHS = [
  PATHS.home,
  PATHS.daily,
  PATHS.catchUp,
  PATHS.habits,
  PATHS.goals,
  PATHS.projects,
  PATHS.learning,
  PATHS.timer,
  PATHS.health,
  PATHS.finance,
  PATHS.journal,
  PATHS.knowledge,
  PATHS.calendar(),
  PATHS.people,
  PATHS.career,
  PATHS.analytics,
  PATHS.reviews,
  PATHS.settings,
] as const

/** Reachable without a session; the proxy lets these through untouched. */
export const PUBLIC_PATHS = [
  PATHS.login,
  PATHS.api.health,
  PATHS.api.googleAuth,
  PATHS.manifest,
  PATHS.firebaseAuthHandler,
] as const
