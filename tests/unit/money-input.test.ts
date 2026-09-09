import { describe, expect, it } from 'vitest'
import {
  caretAfterDigits,
  formatMoneyInput,
  moneySeparators,
  parseMoneyInput,
} from '@/lib/format/money'

const vi = moneySeparators('vi')
const en = moneySeparators('en')

describe('separators follow the locale', () => {
  it('uses a dot for thousands in Vietnamese and a comma in English', () => {
    expect(vi).toEqual({ group: '.', decimal: ',' })
    expect(en).toEqual({ group: ',', decimal: '.' })
  })
})

describe('typing an amount', () => {
  it('groups thousands as the digits arrive', () => {
    const typed = ['1', '10', '100', '1000', '10000', '100000']
    expect(typed.map((step) => formatMoneyInput(parseMoneyInput(step, vi), vi))).toEqual([
      '1',
      '10',
      '100',
      '1.000',
      '10.000',
      '100.000',
    ])
  })

  it('keeps regrouping text that already has separators', () => {
    // What the field actually re-reads on the next keystroke.
    expect(formatMoneyInput(parseMoneyInput('100.000', vi), vi)).toBe('100.000')
    expect(formatMoneyInput(parseMoneyInput('100.0000', vi), vi)).toBe('1.000.000')
    expect(formatMoneyInput(parseMoneyInput('1,000,000', en), en)).toBe('1,000,000')
  })

  it('reads a Vietnamese group separator as grouping, never as a decimal point', () => {
    expect(parseMoneyInput('1.000', vi)).toBe('1000')
    expect(parseMoneyInput('1.000.000', vi)).toBe('1000000')
  })

  it('opens a fraction only on the locale decimal separator', () => {
    expect(parseMoneyInput('1.234,56', vi)).toBe('1234.56')
    expect(parseMoneyInput('1,234.56', en)).toBe('1234.56')
    expect(formatMoneyInput('1234.56', vi)).toBe('1.234,56')
  })

  it('ignores letters, symbols and a second decimal separator', () => {
    expect(parseMoneyInput('1a2b3', vi)).toBe('123')
    expect(parseMoneyInput('100.000 đ', vi)).toBe('100000')
    expect(parseMoneyInput('1,5,7', vi)).toBe('1.57')
  })

  it('treats an empty or half-typed field as empty', () => {
    expect(parseMoneyInput('', vi)).toBe('')
    expect(parseMoneyInput(',', vi)).toBe('')
    expect(formatMoneyInput('', vi)).toBe('')
  })

  it('accepts a leading minus only where negatives are allowed', () => {
    expect(parseMoneyInput('-500000', vi, true)).toBe('-500000')
    expect(formatMoneyInput('-500000', vi)).toBe('-500.000')
    expect(parseMoneyInput('-500000', vi)).toBe('500000')
  })

  it('round-trips to a number the server can parse', () => {
    for (const [input, expected] of [
      ['100000', 100000],
      ['1.234.567', 1234567],
      ['0', 0],
      ['1.234,5', 1234.5],
    ] as const) {
      expect(Number(parseMoneyInput(input, vi))).toBe(expected)
    }
  })
})

describe('caret placement after regrouping', () => {
  it('stays after the digit that was just typed', () => {
    // "1000" became "1.000": four digits to the left means the very end.
    expect(caretAfterDigits('1.000', 4)).toBe(5)
    // Typing in the middle of "100.000" after three digits: before the dot.
    expect(caretAfterDigits('100.000', 3)).toBe(3)
  })

  it('goes to the first digit when nothing precedes the caret', () => {
    expect(caretAfterDigits('1.000', 0)).toBe(0)
    expect(caretAfterDigits('', 0)).toBe(0)
  })

  it('clamps to the end when digits were deleted', () => {
    expect(caretAfterDigits('1.000', 9)).toBe(5)
  })
})
