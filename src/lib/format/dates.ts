import type { ISODate } from '@/lib/dates'

/**
 * Every date format the app renders, in one place.
 *
 * These are named formats for `next-intl`: a component asks for
 * `format.dateTime(value, 'dayMonth')` instead of spelling out an options
 * object, so a change to how dates read is a change here and nowhere else.
 * The names are wired into the request config and the client provider, and
 * `AppConfig` makes them type-checked, so a typo is a compile error.
 *
 * Numeric dates are the exception. `Intl` writes them in the order the locale
 * prefers, which is dd/mm/yyyy in Vietnamese and mm/dd/yyyy in English — the
 * same string meaning two different days. This app writes them dd/mm/yyyy in
 * both, which is what the person using it reads, so those two are built here
 * rather than handed to `Intl`.
 */
export const FORMATS = {
  dateTime: {
    /** Sun, 14 Sep — a date in a list, where the year is obvious. */
    weekdayDayMonth: { weekday: 'short', day: 'numeric', month: 'short' },
    /** Sun, 14 Sep 2026 — the same, where it is not. */
    weekdayDayMonthYear: {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
    /** 14 Sep — tight columns and chart axes. */
    dayMonth: { day: 'numeric', month: 'short' },
    /** 14 Sep 2026. */
    dayMonthYear: { day: 'numeric', month: 'short', year: 'numeric' },
    /** Sunday, 14 September — a page that is about one day. */
    fullDay: { weekday: 'long', day: 'numeric', month: 'long' },
    /** September 2026. */
    monthYear: { month: 'long', year: 'numeric' },
    /** September. */
    month: { month: 'long' },
    /** Sun 14 — a row label inside a week that is already named. */
    weekdayDay: { weekday: 'short', day: 'numeric' },
    /** Sun — a column head. */
    weekday: { weekday: 'short' },
    /** S — a mini calendar. */
    weekdayNarrow: { weekday: 'narrow' },
    /** 09:30. */
    time: { hour: '2-digit', minute: '2-digit' },
    /** 09:30:07 — the wall clock, never in twelve-hour form. */
    clock: { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false },
    /** 14 Sep, 09:30. */
    dayMonthTime: { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
    /** Sun, 14 Sep, 09:30. */
    weekdayDayMonthTime: {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    },
  },
} as const

/** `14/09/2026`. The order does not follow the locale — see FORMATS. */
export function formatDate(date: ISODate): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`
}

/** `14/09`, for a column that has no room for the year. */
export function formatDayMonth(date: ISODate): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`
}
