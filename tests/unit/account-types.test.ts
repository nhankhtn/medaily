import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { accountBrand, accountMark } from '../../src/features/finance/account-icon'
import { ACCOUNT_TYPES, toAccountType } from '../../src/lib/finance/account-types'
import en from '../../messages/en.json'
import vi from '../../messages/vi.json'

describe('account types', () => {
  it('has a label in both locales for every type', () => {
    for (const type of ACCOUNT_TYPES) {
      expect(en.finance.accountTypes[type], `en ${type}`).toBeTruthy()
      expect(vi.finance.accountTypes[type], `vi ${type}`).toBeTruthy()
    }
  })

  it('names no label the picker cannot show', () => {
    expect(Object.keys(en.finance.accountTypes).sort()).toEqual([...ACCOUNT_TYPES].sort())
  })

  it('has an icon and a colour for every type', () => {
    for (const type of ACCOUNT_TYPES) {
      const mark = accountMark(type)
      expect(mark.icon, `icon ${type}`).toBeTruthy()
      expect(mark.color, `colour ${type}`).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('points every brand at a file that is actually there', () => {
    for (const type of ACCOUNT_TYPES) {
      const brand = accountBrand(type)
      if (brand) expect(existsSync(`public${brand.src}`), brand.src).toBe(true)
    }
  })

  it('falls back to the generic bank for a value it does not know', () => {
    expect(toAccountType('techcombank')).toBe('bank')
    expect(toAccountType(null)).toBe('bank')
    expect(toAccountType('momo')).toBe('momo')
  })
})
