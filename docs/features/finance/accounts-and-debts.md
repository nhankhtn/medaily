---
title: Accounts and debts
description: Keep the accounts your money sits in, track who owes whom, and record assets, liabilities and investments.
sidebar_position: 3
---

# Accounts and debts

The **Accounts** tab holds everything your money is, rather than everything it
does: the accounts transactions sit in, the running total of what each person
owes you or you owe them, your assets and liabilities, and your investments.

| | |
| --- | --- |
| **Where** | `/finance` → **Accounts** tab |
| **Works offline** | No |
| **Needs** | Nothing extra. A debt needs a contact under [People](../people.md) |

## Rules

- A transaction needs an account, so an account comes first.
- A transaction that names someone from your contacts is a debt; nothing else is.
- Money going out to a person is you lending or paying them back; money coming in is them paying you back or you borrowing.
- Each person has one debt figure: above zero they owe you, below zero you owe them.
- A debt is never marked "settled" — settling a debt is recording the repayment.
- Debts are left out of income and expense totals and out of the report.
- A debt lowers the account balance but not your net worth.
- A transfer cannot be a debt.
- Investment prices are entered by hand; there is no market data feed.
- Deleting an account that has transactions hides it; its transactions stay in the ledger.

## Add an account

1. Go to **Finance** → **Accounts**.
2. Press **New account**.
3. Name it and pick a type: **Cash**, **BIDV**, **Vietcombank**, **VIB**, **Other bank**, **Momo**, **Other e-wallet**, **Credit card**, **Investment** or **Loan**.
4. Pick the currency and enter the **Opening balance**.
5. Save. The account can now be picked on any transaction.

## Delete an account

1. Open the account and choose **Delete account**.
2. If nothing is filed under it, it is deleted. If it has transactions, it is hidden instead: *Account hidden. Its N transactions are still in the ledger.*

## Record a debt

1. Add a transaction as usual — see [Transactions](./transactions.md).
2. Choose **Income** or **Expense**, not **Transfer**.
3. In the **Debt** field, pick the person. They must exist under [People](../people.md).
4. Save. The amount is added to that person's figure in the debts card on the **Accounts** tab.

Lend someone money: an **Expense** naming them. They pay you back: an
**Income** naming them. Borrow from someone: an **Income** naming them. Pay
them back: an **Expense** naming them.

## Settle a debt

1. Record the repayment as a transaction naming the same person, in the direction the money actually moved.
2. When the figure reaches zero, the debt is settled. There is no tick box to press.

## Record assets, liabilities and investments

1. On the **Accounts** tab, use **Add** under assets and liabilities to record something you own or owe outside your accounts.
2. Use **Add holding** under investments to record a holding: its symbol, quantity and average cost.
3. Type its last price by hand whenever you want the market value and unrealised gain to be current. The date the price was entered is kept beside it.

## How it works

**Why a person makes a debt.** Which way a debt counts follows from the
transaction itself, so there is no separate "debt" record to keep in step.
Money going out is you lending or paying someone back; money coming in is them
paying you back or you borrowing. Those add up to one number per person, shown
in a card on the Accounts tab.

**Why nothing is ever "settled".** Settling a debt *is* recording the
repayment, so a debt cannot go stale behind a tick box someone forgot.

**Why debts stay out of the totals.** Money you lend is not money you spent, so
debts are left out of the income and expense totals and out of the
[report](./report.md). Your account balance still drops, because the money
really did leave; your net worth does not, because you are owed it.

**Why a transfer cannot be a debt.** A transfer moves money between two
accounts you already own, so there is nobody on the other side, and the field
is not offered.

**Hiding instead of deleting.** Deleting an account or category that something
is filed under hides it instead, and the entries keep it.

**Prices by hand.** The app fetches no market data. An investment's value is
only as fresh as the last price you typed.

## Limits

- No market data feed for investments.
- A debt can only name someone already under People.

## Related

- [Finance overview](./overview.md) — the four tabs and net worth
- [Transactions](./transactions.md) — how a debt is recorded, and the **Debt** field
- [People](../people.md) — the contacts a debt is held against
- [Sending money](./sending-money.md) — pay a contact back straight from the add form
- [Report](./report.md) — why debts do not show up in spending
- [Budgets](./budgets.md) — lending is not spending, so it does not use up a budget
- [Data model: finance](../../reference/data-model/finance.md) — tables behind this page
