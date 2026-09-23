/**
 * A v4 uuid, including where `crypto.randomUUID` is missing.
 *
 * That function is gated on a secure context, and the phone testing this app
 * over `http://<lan-ip>:3000` is not one — it comes back undefined and the
 * call throws. `getRandomValues` carries no such gate, so the bytes are always
 * available; only the convenience wrapper around them is not.
 *
 * The shape matters as much as the randomness: this id becomes a primary key
 * and is validated as a uuid on the way in, so a merely-unique string would be
 * refused by the server rather than saved.
 */
export function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  // Version 4 in the high nibble of byte 6, RFC variant in the top bits of 8.
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
