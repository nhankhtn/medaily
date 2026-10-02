---
title: Finance overview
description: Track accounts, transactions, budgets, debts, assets and investments, and see what the numbers add up to.
sidebar_position: 1
---

# Finance overview

Finance is where you record money: the accounts it sits in, what comes in and
goes out, what you allow yourself each month, what people owe you, and what you
own. It answers "where did it go" and "how much is left" without a spreadsheet.

| | |
| --- | --- |
| **Where** | `/finance` · sidebar → Life · on a phone, in the dock |
| **Works offline** | Adding a transaction only — see [Transactions](./transactions.md) |
| **Needs** | Nothing extra. Quick capture needs `AI_SERVICE_URL`; the nightly budget carry-forward needs `CRON_SECRET` — see [Configuration](../../operations/configuration.md) |

## Rules

- You need an account before you can record a transaction — a transaction has to sit somewhere.
- Every transaction is income, expense or transfer.
- A transfer moves money between two of your own accounts and is never income or expense.
- A transaction that names a person is a debt, and debts are left out of income and expense totals and out of the report.
- Investment prices are typed by hand; the app fetches no market data.
- Deleting an account or category that something is filed under hides it; the entries keep it.

## Start using finance

1. Open **Finance** and go to the **Accounts** tab.
2. Press **New account**, name it, pick its type and enter its opening balance.
3. Optionally press **New category** to create the expense and income categories you want.
4. Go back to **Overview** and record your first income, expense or transfer.
5. When you have a few categories, set monthly limits on the **Budgets** tab.

## The four tabs

| Tab | What is on it | Details |
| --- | --- | --- |
| **Overview** | Net worth, cash, and this month's income and expense against last month's; the add form; the ledger, with filters and a search | [Transactions](./transactions.md), [Sending money](./sending-money.md) |
| **Accounts** | Debts, accounts, categories, assets and liabilities, and investments | [Accounts and debts](./accounts-and-debts.md) |
| **Budgets** | One month at a time | [Budgets](./budgets.md) |
| **Report** | What the numbers add up to | [Report](./report.md) |

## How it works

Amounts format as you type: `100000` becomes `100.000`.

Income and expense totals, budgets and the report all count the same thing —
money that actually came in or went out. Two kinds of movement are kept out of
them on purpose:

- **Transfers** between your own accounts, because moving money from your bank
  to your wallet is neither earning nor spending.
- **Debts**, because money you lend is not money you spent. Your account
  balance still drops, because the money really did leave; your net worth does
  not, because you are owed it.

Quick capture can read a sentence like *"banh mi 30k this morning, coffee 25k,
lunch 55k"* and propose the transactions; nothing is saved until you confirm.
It needs a connection and the AI service.

## Limits

- No market data: investment prices are whatever you last typed.
- Only adding a transaction works offline; editing and deleting need a connection.
- The app cannot see your bank, so a payment made through [Sending money](./sending-money.md) is confirmed by you, not detected.

## Related

- [Transactions](./transactions.md) — adding, editing, offline queue, kinds, transfers and categories
- [Accounts and debts](./accounts-and-debts.md) — accounts, debts per person, assets and investments
- [Budgets](./budgets.md) — monthly limits per category and how a new month is filled
- [Sending money](./sending-money.md) — paying a contact by QR code, MoMo or bank app
- [Report](./report.md) — balance over time, spending by category, month against a normal month
- [Quick capture and the assistant](../assistant.md) — type spending as a sentence and file it as transactions
- [People](../people.md) — contacts a debt or a payment is recorded against, and their payment details
- [Daily log](../daily-log.md) — the offline queue finance reuses for adding transactions
- [Notifications](../notifications.md) — a transaction dated today keeps the evening reminder away
- [Scheduled jobs](../../operations/scheduled-jobs.md) — the nightly job that carries budgets forward
- [Configuration](../../operations/configuration.md) — the AI service and the cron secret finance depends on
- [Data model: finance](../../reference/data-model/finance.md) — tables behind these pages
