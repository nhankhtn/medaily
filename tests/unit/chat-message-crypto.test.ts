import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { bodyAad, openBody, sealBody, type SealedBody } from '@/lib/chat/message-crypto'

const MAIN = randomBytes(32).toString('base64')
const SPARE = randomBytes(32).toString('base64')
const STRANGER = randomBytes(32).toString('base64')

const AAD = bodyAad('653f1a2b3c4d5e6f70819200', 'room-1')

function withKeys(main?: string, spare?: string) {
  if (main === undefined) delete process.env.CHAT_MESSAGE_KEY
  else process.env.CHAT_MESSAGE_KEY = main
  if (spare === undefined) delete process.env.CHAT_MESSAGE_KEY_SPARE
  else process.env.CHAT_MESSAGE_KEY_SPARE = spare
}

/** Locked with both keys present, which is how production is meant to run. */
function sealedWithBoth(text = 'Chào bạn, 7 giờ tối nhé'): SealedBody {
  withKeys(MAIN, SPARE)
  const sealed = sealBody(text, AAD)
  if (!sealed) throw new Error('expected a sealed body')
  return sealed
}

describe('locking a message body', () => {
  beforeEach(() => withKeys(MAIN, SPARE))
  afterEach(() => withKeys(undefined, undefined))

  it('comes back as it went in, accents and all', () => {
    const sealed = sealedWithBoth()
    expect(openBody(sealed, AAD)).toBe('Chào bạn, 7 giờ tối nhé')
  })

  it('keeps the words out of what is stored', () => {
    const sealed = sealedWithBoth('số tài khoản 1016624177')
    expect(JSON.stringify(sealed)).not.toContain('1016624177')
  })

  // Two messages, same words, same key: nothing about the stored form may
  // match, or the database leaks which people said the same thing.
  it('never produces the same ciphertext twice', () => {
    const a = sealedWithBoth('ok')
    const b = sealedWithBoth('ok')
    expect(a.ct).not.toBe(b.ct)
    expect(a.iv).not.toBe(b.iv)
  })

  it('writes nothing locked when there is no key, so a machine without one still runs', () => {
    withKeys(undefined, undefined)
    expect(sealBody('ok', AAD)).toBeNull()
  })

  it('refuses a key that is not 32 bytes', () => {
    withKeys(Buffer.from('too short').toString('base64'))
    expect(() => sealBody('ok', AAD)).toThrow(/CHAT_MESSAGE_KEY/)
  })
})

describe('two keys, either one opens it', () => {
  afterEach(() => withKeys(undefined, undefined))

  it('opens with the main key alone', () => {
    const sealed = sealedWithBoth()
    withKeys(MAIN, undefined)
    expect(openBody(sealed, AAD)).toBe('Chào bạn, 7 giờ tối nhé')
  })

  it('opens with the spare alone, which is the whole point of keeping one', () => {
    const sealed = sealedWithBoth()
    withKeys(SPARE, undefined)
    expect(openBody(sealed, AAD)).toBe('Chào bạn, 7 giờ tối nhé')
  })

  it('opens with the spare promoted to main and the old main gone', () => {
    const sealed = sealedWithBoth()
    withKeys(SPARE, STRANGER)
    expect(openBody(sealed, AAD)).toBe('Chào bạn, 7 giờ tối nhé')
  })

  /*
   * The trap in running one key for a while and adding the second later: the
   * messages already written are wrapped under the first key only, and the
   * spare opens none of them. It has to be in place before, or the old rows
   * re-wrapped afterwards.
   */
  it('cannot open what was locked before it was added', () => {
    withKeys(MAIN, undefined)
    const sealed = sealBody('ok', AAD)
    if (!sealed) throw new Error('expected a sealed body')

    withKeys(SPARE, undefined)
    expect(() => openBody(sealed, AAD)).toThrow(/no configured key/)
  })

  it('tells a stranger nothing', () => {
    const sealed = sealedWithBoth()
    withKeys(STRANGER, undefined)
    expect(() => openBody(sealed, AAD)).toThrow(/no configured key/)
  })
})

describe('a body is tied to the message it belongs to', () => {
  afterEach(() => withKeys(undefined, undefined))

  it('will not open against another message', () => {
    const sealed = sealedWithBoth()
    withKeys(MAIN, SPARE)
    expect(() => openBody(sealed, bodyAad('653f1a2b3c4d5e6f70819201', 'room-1'))).toThrow()
  })

  it('will not open against another room', () => {
    const sealed = sealedWithBoth()
    withKeys(MAIN, SPARE)
    expect(() => openBody(sealed, bodyAad('653f1a2b3c4d5e6f70819200', 'room-2'))).toThrow()
  })

  it('will not open once a byte has been changed', () => {
    const sealed = sealedWithBoth()
    const raw = Buffer.from(sealed.ct, 'base64')
    raw[0] = raw[0]! ^ 0xff
    withKeys(MAIN, SPARE)
    expect(() => openBody({ ...sealed, ct: raw.toString('base64') }, AAD)).toThrow()
  })

  it('will not open with a wrapped key taken from somewhere else', () => {
    const mine = sealedWithBoth()
    const theirs = sealedWithBoth('something else')
    withKeys(MAIN, SPARE)
    expect(() => openBody({ ...mine, wraps: theirs.wraps }, AAD)).toThrow()
  })
})
