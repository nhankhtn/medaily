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

export type FinanceTab = 'overview' | 'accounts' | 'budgets' | 'report'

export type LearningTab = 'sessions' | 'notes'

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
  /** Learning on one of its tabs; `sessions` is the plain address. */
  learningTab: (tab: LearningTab) => (tab === 'sessions' ? '/learning' : `/learning?tab=${tab}`),
  timer: '/timer',
  health: '/health',
  finance: '/finance',
  /**
   * The finance page on one of its tabs; `overview` is the plain address. The
   * report carries the stretch it is reporting on — `2026-09` or `2026` — so
   * a period can be linked to and the back button returns to the last one.
   */
  financeTab: (tab: FinanceTab, period?: string) => {
    if (tab === 'overview') return '/finance'
    const query = new URLSearchParams({ tab })
    if (period) query.set('period', period)
    return `/finance?${query.toString()}`
  },
  journal: '/journal',
  /** The journal with one entry opened. */
  journalEntry: (id: string) => `/journal?entry=${id}`,

  /** No page of its own any more; the proxy sends it to the notes tab. */
  knowledge: '/knowledge',
  /** Learning's notes tab with one note opened. */
  note: (id: string) => `/learning?tab=notes&note=${id}`,

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
  /**
   * Public, and it has to be: behind the gate a crawler asking for it is
   * redirected and served the sign-in page as HTML, which tells it nothing
   * and reads as a site with no rules at all.
   */
  robots: '/robots.txt',

  /**
   * Terms and privacy. Public for the same reason: these are what someone
   * reads to decide whether to hand over a journal and a ledger, and a page
   * you must first sign up to read cannot inform that decision.
   */
  legal: (document: 'terms' | 'privacy') => `/legal/${document}`,
  legalRoot: '/legal',

  /** What a stranger meets at `/`, before there is an account to sign in to. */
  welcome: '/welcome',
  /**
   * The offline worker. Public, and it has to be: a browser refuses to
   * register a worker whose script was redirected, so leaving it behind the
   * sign-in gate turns offline support off without saying so. Nothing in it
   * is personal — the caching rules, not the cached pages.
   */
  serviceWorker: '/sw.js',

  firebaseAuthHandler: '/__/auth',

  api: {
    health: '/api/health',
    cronSweepImages: '/api/cron/sweep-images',
    googleAuth: '/api/auth/google',
    calendarIcs: '/api/calendar.ics',
    exportJson: '/api/export?format=json',
    exportCsv: (table: string) => `/api/export?format=csv&table=${table}`,
  },
} as const

/**
 * Every page with a fixed address, for the smoke test and the nav registry.
 * The finance report is in here as well: it is a tab rather than a page, but
 * it runs its own queries, and nothing else would notice if one of them broke.
 */
export const STATIC_PAGE_PATHS = [
  PATHS.home,
  PATHS.daily,
  PATHS.catchUp,
  PATHS.habits,
  PATHS.goals,
  PATHS.projects,
  PATHS.learning,
  PATHS.learningTab('notes'),
  PATHS.timer,
  PATHS.health,
  PATHS.finance,
  PATHS.financeTab('report'),
  PATHS.journal,
  PATHS.calendar(),
  PATHS.people,
  PATHS.career,
  PATHS.analytics,
  PATHS.reviews,
  PATHS.settings,
] as const

/**
 * Where to land after signing in. `next` arrives in the URL, so it is whatever
 * the sender wrote: a browser reads `//host` and `/\host` as another origin
 * rather than as a path, and the sign-in page itself would bounce someone who
 * is already signed in straight back here. All three fall back to the home page.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value?.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return PATHS.home
  }
  return value.split(/[?#]/)[0] === PATHS.login ? PATHS.home : value
}

/** Reachable without a session; the proxy lets these through untouched. */
export const PUBLIC_PATHS = [
  PATHS.login,
  PATHS.api.health,
  // Not public in the ordinary sense: it carries no session because the
  // scheduler has none, and checks a shared secret of its own instead.
  PATHS.api.cronSweepImages,
  PATHS.api.googleAuth,
  PATHS.manifest,
  PATHS.robots,
  PATHS.legalRoot,
  PATHS.welcome,
  PATHS.serviceWorker,
  PATHS.firebaseAuthHandler,
] as const
