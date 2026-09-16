/**
 * A Vietnamese account is known by its bank, not by the word "bank" — nobody
 * says "my bank account", they say "cái BIDV". So the brand is the type, and
 * `bank` / `e_wallet` stay behind as the catch-all for everything not listed.
 */
export const ACCOUNT_TYPES = [
  'cash',
  'bidv',
  'vcb',
  'vib',
  'bank',
  'momo',
  'e_wallet',
  'credit_card',
  'investment',
  'loan',
] as const

export type AccountType = (typeof ACCOUNT_TYPES)[number]

export function toAccountType(value: string | null | undefined): AccountType {
  return (ACCOUNT_TYPES as readonly string[]).includes(value ?? '')
    ? (value as AccountType)
    : 'bank'
}
