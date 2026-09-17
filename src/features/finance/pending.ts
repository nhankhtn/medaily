/**
 * A transaction the form has sent but the server has not confirmed yet.
 *
 * Deliberately not a `Transaction`: it has no id, so there is nothing to edit
 * or delete it by, and pretending otherwise would put buttons on the row that
 * cannot work. The `key` is only for React's list.
 */
export type PendingTransaction = {
  key: string
  occurredOn: string
  kind: 'income' | 'expense' | 'transfer'
  amount: number
  accountId: string
  counterAccountId: string | null
  categoryId: string | null
  personId: string | null
  merchant: string | null
}
