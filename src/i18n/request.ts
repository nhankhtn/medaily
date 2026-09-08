import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from './config'

/**
 * Spec 21 — no URL locale prefix. The locale lives in `user_settings` and is
 * mirrored into a cookie so the first server render is already correct and
 * bookmarked URLs stay clean.
 */
export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: 'Asia/Ho_Chi_Minh',
    now: new Date(),
  }
})
