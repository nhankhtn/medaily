import type { AccountType } from './account-types'

/**
 * Opening your own bank app with a transfer to someone else already in it.
 *
 * Two banks are involved and they are not the same one — the mistake this
 * file was rewritten to fix. `app` is the app to open, which is **yours**;
 * the `@` suffix on `ba` is the **payee's** bank, and VietQR checks it
 * separately (`invalid acqId!` for a code it does not know). Sending from
 * BIDV to a Vietcombank account is `app=bidv&ba=<number>@vcb`, and getting
 * that round the wrong way opens an app the sender may not even have.
 *
 * So the two sides have different reach, and only one of them is narrow:
 *
 * - **Paying in** works for every bank in `banks.ts`. A payee at Sacombank is
 *   fine even though Sacombank has no app of its own; nobody opens it.
 * - **Paying out** needs the sender's app to be one of the fifteen with a
 *   registered scheme, and the app only learns which bank that is from the
 *   account type on the transaction — which today names three.
 *
 * Of those fifteen, five registered an entry point for partners —
 * `bidv.smartbanking.partner://`, `mbbank://applink?targetPage=QRPay`,
 * `acbone://CASSO/…` — and VietQR hands those an encrypted, signed payload
 * carrying the transfer. The rest registered a bare scheme and nothing else:
 * `vietcombankmobile://`, `tcb://`, six characters with nowhere to put an
 * account number. That is each bank's own decision and no parameter fixes it.
 *
 * Three rules below came from calling the endpoint rather than from any
 * documentation, and all three fail silently or with a bare scheme, which is
 * why they are enforced here: `url` must be a whole address or no payload is
 * built at all, a note may hold only letters, digits and spaces, and the
 * payee's bank code must be one VietQR knows.
 */

/** Napas code per bank, for the `@` on `ba`. Every bank in `banks.ts`. */
const PAYEE_CODES: Record<string, string> = {
  '970436': 'vcb',
  '970418': 'bidv',
  '970415': 'icb',
  '970405': 'vba',
  '970407': 'tcb',
  '970422': 'mb',
  '970416': 'acb',
  '970432': 'vpb',
  '970441': 'vib',
  '970403': 'stb',
  '970423': 'tpb',
  '970431': 'eib',
  '970443': 'shb',
  '970437': 'hdb',
  '970426': 'msb',
  '970454': 'vccb',
  '970448': 'ocb',
  '970429': 'scb',
}

export type BankApp = {
  appId: string
  /** The app as the store calls it, for a button that names it. */
  name: string
  /** Whether it opens on a filled-in transfer rather than its home screen. */
  autofill: boolean
}

/**
 * The app behind an account type of the person's own.
 *
 * Keyed on the type rather than on a bank code because that is all a
 * transaction carries: the money left `cái BIDV`, and which app to open
 * follows from that. `bank` and `cash` name no brand and so open nothing —
 * widening this is a line in `ACCOUNT_TYPES` and a line here.
 */
const SENDER_APPS: Partial<Record<AccountType, BankApp>> = {
  bidv: { appId: 'bidv', name: 'BIDV SmartBanking', autofill: true },
  vcb: { appId: 'vcb', name: 'Vietcombank', autofill: false },
  vib: { appId: 'vib', name: 'MyVIB', autofill: false },
}

/** Which app to open for money leaving this kind of account, if any. */
export function senderApp(type: AccountType | null | undefined): BankApp | null {
  return (type && SENDER_APPS[type]) || null
}

/** The payee's bank as VietQR names it, or null for one it does not know. */
export function payeeCode(bin: string | null | undefined): string | null {
  return (bin && PAYEE_CODES[bin]) || null
}

/**
 * VietQR refuses a note holding anything but letters, digits and spaces — a
 * slash, a dot or a hyphen each come back as `invalid transaction note!`.
 *
 * That matters because `transferNote` allows all three, and its ordinary
 * output — `an trua 23/09 ref 4f3a9c` — is exactly the shape it rejects. The
 * offenders become spaces rather than vanishing, so `23/09` reads as `23 09`
 * instead of running two numbers together.
 */
export function payableNote(note: string | null | undefined): string | null {
  const clean = (note ?? '')
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return clean === '' ? null : clean
}

export type BankAppLink = {
  /** The app to open — the sender's. */
  app: BankApp
  /** The payee's bank, as a Napas code from `payeeCode`. */
  payeeBank: string
  payeeAccount: string
  /** Dong, whole. Left off when there is nothing positive to send. */
  amount?: number | null
  note?: string | null
  /**
   * Where the bank app offers to return to.
   *
   * Not the courtesy it looks like: leave it out and VietQR answers with a
   * bare scheme, so even the five apps that could fill the form in open on
   * their home screen. Any absolute http or https address will do —
   * `http://localhost:3000` is accepted — and anything else is dropped,
   * which costs the autofill.
   */
  returnUrl?: string | null
}

export function bankAppLink(input: BankAppLink): string | null {
  const account = input.payeeAccount.trim()
  if (account === '' || input.payeeBank === '') return null

  const query = new URLSearchParams({
    app: input.app.appId,
    ba: `${account}@${input.payeeBank}`,
  })
  if (typeof input.amount === 'number' && input.amount > 0) {
    query.set('am', String(Math.round(input.amount)))
  }
  const note = payableNote(input.note)
  if (note) query.set('tn', note)
  if (isReturnable(input.returnUrl)) query.set('url', input.returnUrl)

  return `https://dl.vietqr.io/pay?${query.toString()}`
}

/**
 * VietQR wants a whole address and checks it: a bare word or an empty value
 * drops the payload as surely as leaving the parameter off, and a relative
 * path stops meaning anything the moment it leaves the browser.
 */
function isReturnable(url: string | null | undefined): url is string {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}
