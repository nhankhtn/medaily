import { describe, expect, it } from 'vitest'
import { debtBalances, netDebt, signOf, type DebtRow } from '@/lib/finance/debts'

const nameOf = (id: string) => ({ nam: 'Nam', lan: 'Lan' })[id] ?? '—'

describe('signOf', () => {
  it('counts money leaving you as lending, money arriving as being paid back', () => {
    expect(signOf('expense')).toBe(1)
    expect(signOf('income')).toBe(-1)
  })

  it('ignores a transfer, which is between two of your own accounts', () => {
    expect(signOf('transfer')).toBe(0)
  })
})

describe('debtBalances', () => {
  it('leaves what is still owed after a part payment', () => {
    const rows: DebtRow[] = [
      { personId: 'nam', kind: 'expense', amount: 500 },
      { personId: 'nam', kind: 'income', amount: 200 },
    ]
    expect(debtBalances(rows, nameOf)).toEqual([{ personId: 'nam', name: 'Nam', outstanding: 300 }])
  })

  it('goes negative when you are the one who borrowed', () => {
    const rows: DebtRow[] = [
      { personId: 'lan', kind: 'income', amount: 1000 },
      { personId: 'lan', kind: 'expense', amount: 400 },
    ]
    expect(debtBalances(rows, nameOf)[0]?.outstanding).toBe(-600)
  })

  it('drops anyone squared up rather than listing a zero', () => {
    const rows: DebtRow[] = [
      { personId: 'nam', kind: 'expense', amount: 500 },
      { personId: 'nam', kind: 'income', amount: 500 },
      { personId: 'lan', kind: 'expense', amount: 10 },
    ]
    expect(debtBalances(rows, nameOf).map((row) => row.personId)).toEqual(['lan'])
  })

  it('does not leave a fraction of a cent standing as a debt', () => {
    const rows: DebtRow[] = [
      { personId: 'nam', kind: 'expense', amount: 0.1 },
      { personId: 'nam', kind: 'expense', amount: 0.2 },
      { personId: 'nam', kind: 'income', amount: 0.3 },
    ]
    expect(debtBalances(rows, nameOf)).toEqual([])
  })

  it('puts the biggest either way at the top', () => {
    const rows: DebtRow[] = [
      { personId: 'nam', kind: 'expense', amount: 100 },
      { personId: 'lan', kind: 'income', amount: 900 },
    ]
    expect(debtBalances(rows, nameOf).map((row) => row.personId)).toEqual(['lan', 'nam'])
  })

  it('never counts a transfer', () => {
    const rows: DebtRow[] = [{ personId: 'nam', kind: 'transfer', amount: 5000 }]
    expect(debtBalances(rows, nameOf)).toEqual([])
  })
})

describe('netDebt', () => {
  it('sets what you are owed against what you owe', () => {
    const balances = debtBalances(
      [
        { personId: 'nam', kind: 'expense', amount: 500 },
        { personId: 'lan', kind: 'income', amount: 200 },
      ],
      nameOf,
    )
    expect(netDebt(balances)).toBe(300)
  })
})
