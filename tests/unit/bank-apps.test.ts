import { describe, expect, it } from 'vitest'
import { ACCOUNT_TYPES } from '@/lib/finance/account-types'
import { bankAppLink, payableNote, payeeCode, senderApp } from '@/lib/finance/bank-apps'
import { BANKS } from '@/lib/finance/banks'

const BIDV = senderApp('bidv')!
const VCB = senderApp('vcb')!

describe('senderApp', () => {
  it('names the app behind an account brand', () => {
    expect(BIDV).toEqual({ appId: 'bidv', name: 'BIDV SmartBanking', autofill: true })
  })

  /** `bank` and `cash` name no brand, so there is no app to open. */
  it('answers null for an account that names no bank', () => {
    for (const type of ['bank', 'cash', 'e_wallet', 'credit_card', 'loan'] as const) {
      expect(senderApp(type), type).toBeNull()
    }
    expect(senderApp(null)).toBeNull()
  })

  it('only ever claims an account type the app really has', () => {
    for (const type of ACCOUNT_TYPES) {
      const app = senderApp(type)
      if (app) expect(app.appId, type).toBe(type)
    }
  })
})

describe('payeeCode', () => {
  /**
   * Every bank the app can hold an account for, including the three with no
   * app of their own — nobody opens the payee's app, so it does not matter.
   */
  it('knows a code for every bank in the list', () => {
    for (const bank of BANKS) expect(payeeCode(bank.bin), bank.name).toBeTruthy()
  })

  it('answers null for a code VietQR would refuse', () => {
    expect(payeeCode('000000')).toBeNull()
    expect(payeeCode(null)).toBeNull()
  })
})

describe('bankAppLink', () => {
  /**
   * The two banks are not the same one. Paying a Vietcombank account from a
   * BIDV account opens BIDV and names `vcb` on the account — the other way
   * round opens an app the sender may not have.
   */
  it('opens the sender app and names the payee bank', () => {
    const link = bankAppLink({
      app: BIDV,
      payeeBank: payeeCode('970436')!,
      payeeAccount: '9344012210',
      amount: 10000,
      note: 'Thanhtoan',
      returnUrl: 'https://medaily.id.vn',
    })
    expect(link).toBe(
      'https://dl.vietqr.io/pay?app=bidv&ba=9344012210%40vcb&am=10000&tn=Thanhtoan' +
        '&url=https%3A%2F%2Fmedaily.id.vn',
    )
  })

  it('pays a bank that has no app of its own', () => {
    const link = bankAppLink({ app: BIDV, payeeBank: payeeCode('970403')!, payeeAccount: '1' })
    expect(link).toContain('ba=1%40stb')
  })

  /** Some apps read `am=0` as a transfer of nothing rather than a blank field. */
  it('leaves the amount out when there is none to send', () => {
    for (const amount of [0, -1, null, undefined]) {
      expect(bankAppLink({ app: BIDV, payeeBank: 'vcb', payeeAccount: '1', amount })).not.toContain(
        'am=',
      )
    }
  })

  it('rounds rather than sending a decimal point', () => {
    expect(
      bankAppLink({ app: BIDV, payeeBank: 'vcb', payeeAccount: '1', amount: 10000.6 }),
    ).toContain('am=10001')
  })

  /**
   * The note `transferNote` builds for a real transaction. VietQR refuses the
   * slash, so a link built straight from it came back as
   * `invalid transaction note!` — on every transfer, silently.
   */
  it('survives the note the app actually builds', () => {
    expect(
      bankAppLink({
        app: BIDV,
        payeeBank: 'vcb',
        payeeAccount: '1',
        note: 'an trua 23/09 ref 4f3a9c',
      }),
    ).toContain('tn=an+trua+23+09+ref+4f3a9c')
  })

  it('passes on any whole address, which is what unlocks the payload', () => {
    for (const url of ['https://medaily.id.vn/finance', 'http://localhost:3000/finance']) {
      const link = bankAppLink({ app: VCB, payeeBank: 'vcb', payeeAccount: '1', returnUrl: url })
      expect(link, url).toContain(`url=${encodeURIComponent(url)}`)
    }
  })

  it('leaves out anything that is not a whole address', () => {
    for (const url of ['abc', '/finance', '', null, undefined]) {
      expect(
        bankAppLink({ app: BIDV, payeeBank: 'vcb', payeeAccount: '1', returnUrl: url }),
      ).not.toContain('url=')
    }
  })

  it('answers null without an account or a bank to send to', () => {
    expect(bankAppLink({ app: BIDV, payeeBank: 'vcb', payeeAccount: '  ' })).toBeNull()
    expect(bankAppLink({ app: BIDV, payeeBank: '', payeeAccount: '1' })).toBeNull()
  })
})

/**
 * Checked against the live endpoint: a slash, a dot or a hyphen each come back
 * as `{"message":"invalid transaction note!"}`, from MB and BIDV alike.
 */
describe('payableNote', () => {
  it('keeps letters, digits and spaces', () => {
    expect(payableNote('an trua ref 4f3a9c')).toBe('an trua ref 4f3a9c')
  })

  it.each([
    ['an trua 23/09', 'an trua 23 09'],
    ['an trua.ref', 'an trua ref'],
    ['an-trua ref', 'an trua ref'],
    ['cafe #3 (sang)', 'cafe 3 sang'],
  ])('turns %j into %j rather than having it refused', (raw, clean) => {
    expect(payableNote(raw)).toBe(clean)
  })

  it('answers null when nothing usable is left', () => {
    for (const note of ['', '   ', '///', null, undefined]) expect(payableNote(note)).toBeNull()
  })
})
