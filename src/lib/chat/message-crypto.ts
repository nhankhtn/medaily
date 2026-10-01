import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const KEY_BYTES = 32
const IV_BYTES = 12
const TAG_BYTES = 16

/**
 * What a message body looks like once it is locked.
 *
 * The words are encrypted under a key of their own, made fresh for this one
 * message and never stored. That key is then wrapped once per key in the
 * environment, which is what lets a spare key open everything the main one
 * can: two locks on the same box rather than two copies of the box.
 *
 * Rotating is the same move — put the new key in beside the old one, re-wrap,
 * and drop the old one once nothing is wrapped under it any more.
 */
export type SealedBody = {
  v: 1
  iv: string
  ct: string
  /** Key id to `<iv>.<the message's own key, wrapped>`. */
  wraps: Record<string, string>
}

type NamedKey = { id: string; bytes: Buffer }

/**
 * An id to say *which* key, never the key. The first bytes of its digest are
 * plenty to pick one out of two and tell you nothing about the rest.
 */
function named(raw: string | undefined, name: string): NamedKey | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null

  const bytes = Buffer.from(trimmed, 'base64')
  if (bytes.length !== KEY_BYTES) {
    throw new Error(`${name} must be ${KEY_BYTES} bytes of base64, got ${bytes.length}`)
  }
  return { id: createHash('sha256').update(bytes).digest('hex').slice(0, 8), bytes }
}

/**
 * Read at every call rather than once at import: a key read on the way up is
 * a key you cannot change without a deploy, and tests would be stuck with
 * whichever one loaded first.
 */
function keyring(): { primary: NamedKey | null; all: NamedKey[] } {
  const primary = named(process.env.CHAT_MESSAGE_KEY, 'CHAT_MESSAGE_KEY')
  const spare = named(process.env.CHAT_MESSAGE_KEY_SPARE, 'CHAT_MESSAGE_KEY_SPARE')
  return { primary, all: [primary, spare].filter((key): key is NamedKey => key !== null) }
}

function lock(key: Buffer, plain: Buffer, aad: Buffer): { iv: string; ct: string } {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(aad)
  const body = Buffer.concat([cipher.update(plain), cipher.final()])
  return {
    iv: iv.toString('base64'),
    ct: Buffer.concat([body, cipher.getAuthTag()]).toString('base64'),
  }
}

function unlock(key: Buffer, iv: string, ct: string, aad: Buffer): Buffer {
  const raw = Buffer.from(ct, 'base64')
  if (raw.length < TAG_BYTES) throw new Error('ciphertext is too short to hold its tag')

  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
  decipher.setAAD(aad)
  decipher.setAuthTag(raw.subarray(raw.length - TAG_BYTES))
  return Buffer.concat([decipher.update(raw.subarray(0, raw.length - TAG_BYTES)), decipher.final()])
}

/**
 * Ties a message to where it lives.
 *
 * Without it, anyone who can write to the database could lift a locked body
 * out of one message and drop it into another — a different room, a different
 * author — and it would still open. The tag is computed over this too, so a
 * body that has been moved no longer opens at all.
 */
export function bodyAad(messageId: string, roomId: string): string {
  return `${messageId}:${roomId}`
}

/**
 * Locks a body, or returns null when there is no key to lock it with.
 *
 * Null is not a failure: it is how a machine with no key configured keeps
 * working, writing the body as it always did. Encryption switches on when a
 * key appears, and the two kinds of row live side by side for good.
 */
export function sealBody(plain: string, aad: string): SealedBody | null {
  const { primary, all } = keyring()
  if (!primary) return null

  const dek = randomBytes(KEY_BYTES)
  const extra = Buffer.from(aad, 'utf8')
  const { iv, ct } = lock(dek, Buffer.from(plain, 'utf8'), extra)

  const wraps: Record<string, string> = {}
  for (const key of all) {
    const wrapped = lock(key.bytes, dek, extra)
    wraps[key.id] = `${wrapped.iv}.${wrapped.ct}`
  }
  return { v: 1, iv, ct, wraps }
}

/**
 * Opens a body with whichever key is to hand.
 *
 * Throws rather than returning something. A key that has gone missing is a
 * misconfigured machine, and a room that quietly renders every message blank
 * would look exactly like a room somebody emptied.
 */
export function openBody(sealed: SealedBody, aad: string): string {
  const extra = Buffer.from(aad, 'utf8')

  for (const key of keyring().all) {
    const wrap = sealed.wraps[key.id]
    if (!wrap) continue

    const split = wrap.indexOf('.')
    if (split < 1) continue

    const dek = unlock(key.bytes, wrap.slice(0, split), wrap.slice(split + 1), extra)
    return unlock(dek, sealed.iv, sealed.ct, extra).toString('utf8')
  }

  throw new Error(
    `no configured key opens this message (it was locked with ${Object.keys(sealed.wraps).join(', ') || 'nothing'})`,
  )
}
