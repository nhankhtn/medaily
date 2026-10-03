import { describe, expect, it } from 'vitest'
import {
  grantTransactionBody,
  inputProblem,
} from '@/app/api/external/grant/transaction/route'
import { addDays } from '@/lib/dates'
import { isGrantDay } from '@/server/services/grant-transaction'

const today = '2026-10-03'

describe('isGrantDay', () => {
  it('allows today and the two days before it', () => {
    expect(isGrantDay(today, today)).toBe(true)
    expect(isGrantDay(addDays(today, -1), today)).toBe(true)
    expect(isGrantDay(addDays(today, -2), today)).toBe(true)
  })

  it('refuses a future day and a day three back', () => {
    expect(isGrantDay(addDays(today, 1), today)).toBe(false)
    expect(isGrantDay(addDays(today, -3), today)).toBe(false)
  })
})

describe('grant transaction body', () => {
  it('names the date field when the day is not yyyy-MM-dd', () => {
    const parsed = grantTransactionBody.safeParse({
      amount: 15000,
      merchant: 'bánh mì',
      occurredOn: '19/01/2026',
    })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(inputProblem(parsed.error)).toEqual({
        field: 'occurredOn',
        expected: 'expected yyyy-MM-dd',
      })
    }
  })
})
