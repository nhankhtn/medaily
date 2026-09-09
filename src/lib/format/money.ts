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

/* ------------------------------------------------------------------------- *
 * Money *input* formatting — grouped digits while the user is still typing.
 * Kept here, pure and locale-driven, so it can be tested without a DOM.
 * ------------------------------------------------------------------------- */

export type MoneySeparators = { group: string; decimal: string }

/** Read the separators off the locale rather than hard-coding `.` and `,`. */
export function moneySeparators(locale: string): MoneySeparators {
  const parts = new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US').formatToParts(1234.5)
  return {
    group: parts.find((part) => part.type === 'group')?.value ?? ',',
    decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
  }
}

const isDigit = (char: string | undefined) => char !== undefined && char >= '0' && char <= '9'

export const countDigits = (text: string) => [...text].filter(isDigit).length

/**
 * Display text to a plain number string. The group separator is always
 * dropped — in Vietnamese `1.000` is a thousand, never one — and only the
 * locale's own decimal separator opens a fraction.
 */
export function parseMoneyInput(
  text: string,
  separators: MoneySeparators,
  allowNegative = false,
): string {
  const negative = allowNegative && text.trimStart().startsWith('-')
  let digits = ''
  let fraction: string | null = null

  for (const char of text.split(separators.group).join('')) {
    if (isDigit(char)) {
      if (fraction === null) digits += char
      else fraction += char
    } else if (char === separators.decimal && fraction === null) {
      fraction = ''
    }
  }

  if (digits === '' && (fraction === null || fraction === '')) return negative ? '-' : ''
  const body = fraction ? `${digits || '0'}.${fraction}` : digits || '0'
  return negative ? `-${body}` : body
}

/** Plain number string back to grouped display text. */
export function formatMoneyInput(raw: string, separators: MoneySeparators): string {
  if (raw === '' || raw === '-') return raw
  const negative = raw.startsWith('-')
  const [integer = '', fraction] = raw.replace('-', '').split('.')
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, separators.group)
  const body = fraction === undefined ? grouped : `${grouped}${separators.decimal}${fraction}`
  return negative ? `-${body}` : body
}

/**
 * Where the caret belongs after regrouping: right after the same number of
 * digits it had to its left, so inserting a separator never drags it back.
 */
export function caretAfterDigits(text: string, digitsBefore: number): number {
  if (digitsBefore === 0) {
    const first = text.search(/\d/)
    return first < 0 ? text.length : first
  }
  let seen = 0
  for (let index = 0; index < text.length; index += 1) {
    if (isDigit(text[index])) {
      seen += 1
      if (seen === digitsBefore) return index + 1
    }
  }
  return text.length
}
