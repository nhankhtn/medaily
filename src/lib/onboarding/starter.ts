import type { Locale } from '@/i18n/config'

/**
 * What a brand new workspace opens with.
 *
 * Without it the first thing a stranger meets is a ledger that refuses the
 * thing they came to do: recording a expense needs a category, and there are
 * none, so the first act in the app is administration. A handful of buckets
 * everyone has is a better start than an empty page, and every one of them
 * can be renamed or deleted.
 *
 * Deliberately small. These are a starting point, not an opinion about how
 * someone should file their money — a long list is its own kind of empty
 * page, and the ones nobody wants have to be deleted one at a time.
 *
 * Not in `messages/*.json` even though a person reads them: those are UI
 * strings the app owns and re-renders, these are rows the person now owns and
 * will rename. A category called `t('finance.starter.food')` would change
 * name when they switch language, which is not what renaming means.
 */
export type StarterCategory = { name: string; kind: 'income' | 'expense' }
export type StarterAccount = { name: string; type: 'cash' | 'bank' }

type Starter = { categories: StarterCategory[]; accounts: StarterAccount[] }

const STARTERS: Record<Locale, Starter> = {
  vi: {
    categories: [
      { name: 'Lương', kind: 'income' },
      { name: 'Thu khác', kind: 'income' },
      { name: 'Ăn uống', kind: 'expense' },
      { name: 'Đi lại', kind: 'expense' },
      { name: 'Nhà cửa', kind: 'expense' },
      { name: 'Mua sắm', kind: 'expense' },
      { name: 'Sức khoẻ', kind: 'expense' },
      { name: 'Chi khác', kind: 'expense' },
    ],
    accounts: [
      { name: 'Tiền mặt', type: 'cash' },
      { name: 'Ngân hàng', type: 'bank' },
    ],
  },
  en: {
    categories: [
      { name: 'Salary', kind: 'income' },
      { name: 'Other income', kind: 'income' },
      { name: 'Food', kind: 'expense' },
      { name: 'Transport', kind: 'expense' },
      { name: 'Home', kind: 'expense' },
      { name: 'Shopping', kind: 'expense' },
      { name: 'Health', kind: 'expense' },
      { name: 'Other', kind: 'expense' },
    ],
    accounts: [
      { name: 'Cash', type: 'cash' },
      { name: 'Bank', type: 'bank' },
    ],
  },
}

export function starterFor(locale: Locale): Starter {
  return STARTERS[locale]
}
