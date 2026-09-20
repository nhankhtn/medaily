import { Be_Vietnam_Pro, Outfit } from 'next/font/google'

/**
 * Body UI: Be Vietnam Pro (Latin + Vietnamese).
 * Brand / wordmark: Outfit (display). Prefer `font-brand` on logo titles only —
 * Vietnamese copy should stay on the body face so diacritics render correctly.
 */
export const fontSans = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam',
  display: 'swap',
})

export const fontBrand = Outfit({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-outfit',
  display: 'swap',
})
