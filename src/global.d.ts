import type { FORMATS } from '@/lib/format/dates'

/**
 * Makes `format.dateTime(value, '...')` type-checked against the shared format
 * names, so a typo is a compile error instead of a silently unformatted date.
 *
 * `Messages` is deliberately left out: plenty of labels here come from a
 * registry and are looked up with a computed key, which a literal union
 * cannot express.
 */
declare module 'next-intl' {
  interface AppConfig {
    Locale: 'en' | 'vi'
    Formats: typeof FORMATS
  }
}
