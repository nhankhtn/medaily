/**
 * VietQR — the Napas 247 flavour of the EMVCo QR payload. One string that a
 * Vietnamese banking app turns into a filled-in transfer: our account, our
 * amount, our reference.
 *
 * Built here rather than fetched from one of the QR-image services, because
 * the input is somebody else's bank account and it has no business leaving
 * the device to come back as a picture.
 */

import { foldText } from '@/lib/text'

/** EMVCo tag-length-value. Length is two digits, so no field may exceed 99. */
function tlv(id: string, value: string): string {
  return id + String(value.length).padStart(2, '0') + value
}

/**
 * CRC-16/CCITT-FALSE over everything before the checksum, the trailing `6304`
 * included — the spec has the tag and length of the checksum field inside the
 * range it protects.
 */
export function crc16(input: string): string {
  let crc = 0xffff
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export type VietQrInput = {
  /** Napas bank code, six digits — what a bank app shows beside its name, not the SWIFT code. */
  bin: string
  accountNumber: string
  /** Omit for a QR the payer types the amount into. */
  amount?: number | null
  /** Reference line. Folded to ASCII and clipped; see `transferNote`. */
  message?: string | null
}

/**
 * EMVCo caps the purpose field at 25 characters, and banks reject the
 * Vietnamese tone marks outright, so the note is folded and clipped rather
 * than passed through.
 */
const MAX_NOTE = 25

/**
 * Enough of the row's id to find it again in a bank statement. Six hex digits
 * is sixteen million — far past anything a personal ledger will hold — and
 * every character costs description that would have been readable instead.
 */
const REF_DIGITS = 6
const REF_LABEL = 'ref '

export function transferReference(transactionId: string): string {
  return transactionId.replace(/-/g, '').slice(0, REF_DIGITS).toLowerCase()
}

/**
 * `an trua 23/09 ref 4f3a9c`
 *
 * The reference is laid down first and the description takes what is left.
 * It is the half that does the work — a statement line matches back to a row
 * by it — so clipping a long merchant name is the cheaper loss.
 */
export function transferNote(
  parts: (string | null | undefined)[],
  transactionId?: string | null,
): string {
  const about = parts
    .map((part) => foldText(part ?? ''))
    .filter((part) => part !== '')
    .join(' ')
    .replace(/[^a-z0-9 .\/-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!transactionId) return about.slice(0, MAX_NOTE).trim()

  const ref = REF_LABEL + transferReference(transactionId)
  const room = MAX_NOTE - ref.length - 1
  const head = room > 0 ? about.slice(0, room).trim() : ''
  return head === '' ? ref : `${head} ${ref}`
}

/**
 * Returns null when the account is not describable as a VietQR target — a
 * half-filled contact should show no code rather than one that scans into
 * somebody else's account.
 */
export function vietQrPayload(input: VietQrInput): string | null {
  const bin = input.bin.replace(/\D/g, '')
  const accountNumber = input.accountNumber.replace(/[^a-zA-Z0-9]/g, '')
  if (bin.length !== 6 || accountNumber === '' || accountNumber.length > 19) return null

  const amount =
    input.amount == null || input.amount <= 0 ? null : String(Math.round(input.amount))
  if (amount !== null && amount.length > 13) return null

  const beneficiary = tlv('00', bin) + tlv('01', accountNumber)
  const merchant =
    // A000000727 is Napas. QRIBFTTA routes to an account number (…TTC is to a card).
    tlv('00', 'A000000727') + tlv('01', beneficiary) + tlv('02', 'QRIBFTTA')

  let payload =
    tlv('00', '01') +
    // 11 is a code that may be scanned repeatedly, 12 one carrying an amount.
    tlv('01', amount === null ? '11' : '12') +
    tlv('38', merchant) +
    tlv('53', '704')
  if (amount !== null) payload += tlv('54', amount)
  payload += tlv('58', 'VN')

  const note = transferNote([input.message])
  if (note !== '') payload += tlv('62', tlv('08', note))

  payload += '6304'
  return payload + crc16(payload)
}
