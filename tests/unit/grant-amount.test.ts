import { describe, expect, it } from 'vitest'
import { isLedgerAmount } from '@/server/services/grant-transaction'

describe('isLedgerAmount', () => {
  it('accepts a positive amount with at most two decimal places', () => {
    expect(isLedgerAmount(15_000)).toBe(true)
    expect(isLedgerAmount(0.01)).toBe(true)
    expect(isLedgerAmount(1_000_000_000)).toBe(true)
  })

  it('refuses a fraction that would round to zero, and anything finer than cents', () => {
    expect(isLedgerAmount(0)).toBe(false)
    expect(isLedgerAmount(0.004)).toBe(false)
    expect(isLedgerAmount(15.555)).toBe(false)
    expect(isLedgerAmount(-1)).toBe(false)
    expect(isLedgerAmount(Number.NaN)).toBe(false)
  })
})