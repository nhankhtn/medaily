---
title: Finance
description: Accounts, categories, transactions, debts and payees, recurring transactions, budgets, assets, investments and the balances view.
sidebar_position: 7
---

# Finance

The finance tables hold accounts and the money that moves between them, the categories and budgets that give it shape, and the assets and investments outside the ledger. Money is always stored positive with its direction in `kind`, and balances are computed in one view. Shared columns are described in [Data model](./overview.md).

## Tables

| Table | Columns worth knowing |
| --- | --- |
| `accounts` | `type` (`cash`, `bank`, `credit_card`, `e_wallet`, `investment`, `loan`, plus the brands `bidv`, `vcb`, `vib`, `momo` from `0015`), `currency` (three letters, `CHECK`ed), `opening_balance` |
| `finance_categories` | `kind` (`income`/`expense`), `note` (`0018` — a short hint of what belongs in the bucket, "coffee shops, not groceries", read by people and by AI capture; matching the model's answer back still keys off `name`), `parent_id` (**no foreign key**), `icon`, `color` |
| `transactions` | `occurred_on`, `amount`, `kind` (`income`/`expense`/`transfer`), `account_id`, `counter_account_id` (the other side of a transfer), `category_id`, `fx_rate`, `merchant` (the one line the ledger shows and the only one search reads — `0023` folded the old `note` column into it and dropped it), `tags`, plus the [people columns](#people-on-a-transaction) below |
| `recurring_transactions` | `name`, `amount`, `kind`, `account_id`, `category_id`, `rule`, `next_due_on`, `ends_on` |
| `budgets` | `category_id`, `period_start`, `amount` (above zero). Unique on `(user_id, category_id, period_start)` — one budget per category per period. `rollover` carries an unspent remainder |
| `assets` | `kind` (`asset`/`liability`), `value`, `as_of` |
| `investments` | `symbol`, `quantity`, `avg_cost`, `last_price`, `priced_at` — prices are typed by hand, with their date; the app fetches no market data |

## Money rules

Money is `numeric`, never a float, and **always stored positive** (`amount_positive`): the direction is `kind`, not a sign. A transfer must name a `counter_account_id` different from `account_id` (`transfer_has_counter_account`), and is one row touching both accounts so income is never inflated.

Deleting an account deletes its transactions and recurring transactions (`ON DELETE CASCADE` on `account_id`); deleting the counter account, a category or a person only clears the pointer (`SET NULL`).

## People on a transaction

`transactions` has two pointers at `people`, and they mean different things:

| Column | Type | Notes |
| --- | --- | --- |
| `person_id` | uuid → `people`, `SET NULL` | A **debt** (`0016`). Money out is lending or paying them back, money in is them paying back or you borrowing; one signed total per person falls out of that. Balances count these rows, but **income and expense totals exclude them** — lending money is not losing it |
| `payee_person_id` | uuid → `people`, `SET NULL` | Who the money is handed to, when paying for something and settling up with whoever covered it are two moments (`0022`). Moves no balance — the expense already left the account |
| `transferred_at` | timestamptz | Set once that hand-off is made or waved off (`0022`). Null is the only state that still asks for something. A flag rather than derived, because the transfer happens in another app and leaves no row |

Where the money is sent — bank account, MoMo number, saved QR — lives on the person, not here. See [People](./people.md).

## `v_account_balances` (view)

Balances come from the `v_account_balances` view, so the arithmetic lives in one place: one row per account with `account_id`, `user_id`, `name`, `type`, `currency` and `balance` — `opening_balance` plus income, minus expense, minus transfers out, plus transfers in through `counter_account_id`. Like the other view, it is defined in `drizzle/views.sql`.

## Related

- [Data model](./overview.md) — conventions shared by every table
- [Finance overview](../../features/finance/overview.md) — what the finance pages cover
- [Transactions](../../features/finance/transactions.md) — writes `transactions`, kinds, transfers and categories
- [Accounts and debts](../../features/finance/accounts-and-debts.md) — `accounts`, debts through `person_id`, `assets`, `investments`
- [Budgets](../../features/finance/budgets.md) — `budgets` and the `rollover` carry-forward
- [Sending money](../../features/finance/sending-money.md) — `payee_person_id` and `transferred_at`
- [Finance report](../../features/finance/report.md) — income and expense totals that exclude debts
- [Quick capture and the assistant](../../features/assistant.md) — AI capture reads `finance_categories.note`
- [People](../../features/people.md) — the people that debts and payees point at
- [People](./people.md) — the payment columns on `people`
- [Activity trail](./activity-trail.md) — transaction, account and category changes are recorded there
