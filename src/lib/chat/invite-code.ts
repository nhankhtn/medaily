/**
 * An invite code is a credential.
 *
 * Sign-up is open and the allowlists are empty, so a link is the only thing
 * standing between a room and the open internet. 16 random bytes is 128 bits —
 * not a number anybody guesses, and short enough to paste into a message.
 */
export function newInviteCode(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64url')
}
