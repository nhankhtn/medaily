import { describe, expect, it } from 'vitest'
import { BANKS, isSupportedBank } from '@/lib/finance/banks'
import {
  crc16,
  parseVietQr,
  transferNote,
  transferReference,
  vietQrPayload,
} from '@/lib/finance/vietqr'

/** Walks the EMVCo tag-length-value string back into a map, one level deep. */
function parse(payload: string): Record<string, string> {
  const out: Record<string, string> = {}
  let i = 0
  while (i < payload.length) {
    const id = payload.slice(i, i + 2)
    const length = Number(payload.slice(i + 2, i + 4))
    out[id] = payload.slice(i + 4, i + 4 + length)
    i += 4 + length
  }
  return out
}

describe('crc16', () => {
  it('matches the CRC-16/CCITT-FALSE check value', () => {
    expect(crc16('123456789')).toBe('29B1')
  })
})

describe('vietQrPayload', () => {
  const target = { bin: '970436', accountNumber: '001234567890' }

  it('carries the bank, the account, the amount and the note', () => {
    const payload = vietQrPayload({ ...target, amount: 25000, message: 'Ăn trưa 22/09' })
    expect(payload).not.toBeNull()

    const top = parse(payload as string)
    expect(top['53']).toBe('704')
    expect(top['54']).toBe('25000')
    expect(top['58']).toBe('VN')

    const merchant = parse(top['38'] as string)
    expect(merchant['00']).toBe('A000000727')
    expect(merchant['02']).toBe('QRIBFTTA')

    const beneficiary = parse(merchant['01'] as string)
    expect(beneficiary['00']).toBe('970436')
    expect(beneficiary['01']).toBe('001234567890')

    expect(parse(top['62'] as string)['08']).toBe('an trua 22/09')
  })

  it('checksums everything before it, the checksum tag included', () => {
    const payload = vietQrPayload({ ...target, amount: 25000 }) as string
    expect(crc16(payload.slice(0, -4))).toBe(payload.slice(-4))
  })

  it('marks a code with an amount as single-use and one without as reusable', () => {
    const withAmount = vietQrPayload({ ...target, amount: 25000 }) as string
    const without = vietQrPayload(target) as string
    expect(parse(withAmount)['01']).toBe('12')
    expect(parse(without)['01']).toBe('11')
    expect(parse(without)['54']).toBeUndefined()
  })

  it('treats a zero or negative amount as no amount at all', () => {
    expect(parse(vietQrPayload({ ...target, amount: 0 }) as string)['54']).toBeUndefined()
    expect(parse(vietQrPayload({ ...target, amount: -5 }) as string)['54']).toBeUndefined()
  })

  it('ignores spacing and punctuation typed into the account number', () => {
    const spaced = vietQrPayload({ bin: '970436', accountNumber: '0012 3456 7890' }) as string
    expect(parse(parse(parse(spaced)['38'] as string)['01'] as string)['01']).toBe('001234567890')
  })

  it('refuses a target it cannot describe rather than encoding a wrong one', () => {
    expect(vietQrPayload({ bin: '97043', accountNumber: '001234567890' })).toBeNull()
    expect(vietQrPayload({ bin: '970436', accountNumber: '' })).toBeNull()
    expect(vietQrPayload({ bin: '970436', accountNumber: '1'.repeat(20) })).toBeNull()
  })
})

describe('transferNote', () => {
  const id = '4f3a9c12-0000-4000-8000-000000000000'

  it('folds Vietnamese down to what a bank will accept', () => {
    expect(transferNote(['Ăn trưa', '22/09'])).toBe('an trua 22/09')
  })

  it('drops the punctuation banks reject and collapses the gaps', () => {
    expect(transferNote(['Cà phê & bánh', null, 'Nam'])).toBe('ca phe banh nam')
  })

  it('clips to the 25 characters the purpose field holds', () => {
    expect(transferNote(['a'.repeat(40)])).toHaveLength(25)
  })

  it('is empty when there is nothing worth sending', () => {
    expect(transferNote([null, undefined, '  '])).toBe('')
  })

  it('appends a reference taken from the row id', () => {
    expect(transferNote(['Ăn trưa', '23/09'], id)).toBe('an trua 23/09 ref 4f3a9c')
  })

  it('keeps the reference whole and clips the description instead', () => {
    const note = transferNote(['Com tam ba Hai quan 3'], id)
    expect(note.endsWith('ref 4f3a9c')).toBe(true)
    expect(note.length).toBeLessThanOrEqual(25)
  })

  it('is the reference alone when there is nothing to describe', () => {
    expect(transferNote([null], id)).toBe('ref 4f3a9c')
  })
})

describe('transferReference', () => {
  it('is six hex digits of the row id, dashes dropped', () => {
    expect(transferReference('4F3A9C12-0000-4000-8000-000000000000')).toBe('4f3a9c')
  })
})

describe('parseVietQr', () => {
  it('reads back the account a code it built points at', () => {
    const payload = vietQrPayload({
      bin: '970436',
      accountNumber: '001234567890',
      amount: 25000,
      message: 'an trua',
    }) as string
    expect(parseVietQr(payload)).toEqual({ bin: '970436', accountNumber: '001234567890' })
  })

  it('reads a static code, which carries no amount', () => {
    const payload = vietQrPayload({ bin: '970418', accountNumber: '99887766' }) as string
    expect(parseVietQr(payload)).toEqual({ bin: '970418', accountNumber: '99887766' })
  })

  it('is null for a code from somewhere other than Napas', () => {
    expect(parseVietQr('https://me.momo.vn/someone')).toBeNull()
    expect(parseVietQr('')).toBeNull()
    expect(parseVietQr('00020101021163041234')).toBeNull()
  })

  it('is null rather than guessing when the payload is truncated', () => {
    const payload = vietQrPayload({ bin: '970436', accountNumber: '001234567890' }) as string
    expect(parseVietQr(payload.slice(0, 30))).toBeNull()
  })
})

describe('isSupportedBank', () => {
  it('accepts a bank the app can build a code for', () => {
    expect(isSupportedBank('970436')).toBe(true)
  })

  it('rejects a well-formed code the list does not carry, and empty input', () => {
    expect(isSupportedBank('999999')).toBe(false)
    expect(isSupportedBank('')).toBe(false)
    expect(isSupportedBank(null)).toBe(false)
    expect(isSupportedBank(undefined)).toBe(false)
  })

  it('every listed bank is a six-digit Napas code, unique in the list', () => {
    const bins = BANKS.map((bank) => bank.bin)
    expect(bins.every((bin) => /^\d{6}$/.test(bin))).toBe(true)
    expect(new Set(bins).size).toBe(bins.length)
  })
})
