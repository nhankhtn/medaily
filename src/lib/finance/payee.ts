/**
 * Someone a transaction's money is handed to. Paying for lunch and settling
 * up with whoever covered it are two moments; this is what the second one
 * needs to know.
 */

export type Payee = {
  id: string
  name: string
  bankBin: string | null
  bankAccountNumber: string | null
  bankAccountName: string | null
  momoPhone: string | null
  /** A QR the payee sent, kept as the string it decodes to. */
  paymentQr: string | null
}

/** A bank account complete enough to build a VietQR from. */
export function bankTarget(payee: Payee): { bin: string; accountNumber: string } | null {
  if (!payee.bankBin || !payee.bankAccountNumber) return null
  return { bin: payee.bankBin, accountNumber: payee.bankAccountNumber }
}

/**
 * Only people we can actually send money to reach the picker. Everyone else in
 * the contact list would be a dead end at the one moment it matters.
 */
export function canReceive(payee: Payee): boolean {
  return bankTarget(payee) !== null || Boolean(payee.momoPhone) || Boolean(payee.paymentQr)
}

/** A receive link the payee got from MoMo, as opposed to a bare phone number. */
export function isMomoLink(momo: string): boolean {
  return /^https?:\/\//i.test(momo.trim())
}

/**
 * Where tapping "open MoMo" goes.
 *
 * A bare number gets the plain scheme, which only raises the app — no
 * recipient, no amount. `nhantien.momo.vn/<phone>` was tried and does no
 * better, and MoMo publishes no parameter format for a prefilled transfer, so
 * guessing a third shape would only trade a link that opens for one that 404s.
 * The number goes to the clipboard instead, which is the part worth saving.
 *
 * A link the payee pasted in is used exactly as given: MoMo generated it, so
 * it lands where MoMo intends and nothing here needs to know how.
 */
export function momoLink(momo: string): string {
  const value = momo.trim()
  return isMomoLink(value) ? value : 'momo://'
}
