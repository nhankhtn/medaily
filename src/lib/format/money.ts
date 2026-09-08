/**
 * Locale-aware money formatting. VND has no minor units, so the fraction digits
 * follow the currency rather than a hard-coded 2 (spec 12).
 */
export function formatMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'VND' ? 0 : 2,
    }).format(amount)
  } catch {
    // An unknown currency code must not blank the page.
    return `${amount.toLocaleString()} ${currency}`
  }
}

export function formatCompactMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)
  } catch {
    return `${amount.toLocaleString()} ${currency}`
  }
}
