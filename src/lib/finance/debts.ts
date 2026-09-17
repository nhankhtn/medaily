/**
 * What is still owed, worked out from the ledger rather than kept as a state
 * of its own.
 *
 * A debt row is a real movement of money tagged with a person. Which way it
 * pushes follows from its kind: money leaving you is you lending or paying
 * someone back, money arriving is them paying you back or you borrowing. Add
 * those up per person and one signed number says everything — above zero they
 * owe you, below zero you owe them, at zero you are square.
 *
 * Nothing has to be marked settled, because settling *is* recording the
 * repayment. A debt cannot go stale behind a tick box that someone forgot.
 */

/** How much a single debt row moves the balance. Money out counts up. */
export function signOf(kind: string): number {
  if (kind === 'expense') return 1
  if (kind === 'income') return -1
  // A transfer is between two of your own accounts; nobody owes anybody.
  return 0
}

export type DebtRow = { personId: string; kind: string; amount: number }

export type DebtBalance = {
  personId: string
  name: string
  /** Positive: they owe you. Negative: you owe them. */
  outstanding: number
}

/**
 * One line per person still out of balance. Anyone squared up is dropped —
 * a debt that is settled is not news, and a list that keeps them buries the
 * ones that matter.
 */
export function debtBalances(rows: DebtRow[], nameOf: (id: string) => string): DebtBalance[] {
  const totals = new Map<string, number>()

  for (const row of rows) {
    const move = signOf(row.kind) * row.amount
    if (move === 0) continue
    totals.set(row.personId, (totals.get(row.personId) ?? 0) + move)
  }

  return [...totals.entries()]
    .filter(([, outstanding]) => Math.round(outstanding * 100) !== 0)
    .map(([personId, outstanding]) => ({ personId, name: nameOf(personId), outstanding }))
    .sort((a, b) => Math.abs(b.outstanding) - Math.abs(a.outstanding))
}

/** What the balances are worth to you: owed to you less what you owe. */
export function netDebt(balances: DebtBalance[]): number {
  return balances.reduce((total, row) => total + row.outstanding, 0)
}
