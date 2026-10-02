---
title: Transactions
description: Record income, expenses and transfers, file them under categories, and add them even with no signal.
sidebar_position: 2
---

# Transactions

A transaction is one movement of money: something you earned, something you
spent, or money moved between your own accounts. Everything else in finance —
balances, budgets, debts, the report — is added up from them.

| | |
| --- | --- |
| **Where** | `/finance` → **Overview** tab (the add form and the ledger) |
| **Works offline** | Adding, yes, once the page has been opened online. Editing, deleting and quick capture, no |
| **Needs** | At least one account. Quick capture needs `AI_SERVICE_URL` — see [Configuration](../../operations/configuration.md) |

## Rules

- A transaction is one of three kinds: **Income**, **Expense** or **Transfer**.
- A transaction needs an account to sit in, so add an account first.
- A transfer moves money between two of your own accounts and counts as neither income nor expense.
- A transfer cannot be a debt, so the person field is not offered on one.
- A transaction that names a person is a debt — see [Accounts and debts](./accounts-and-debts.md).
- A transaction counts on the date it is filed under, not the day it was typed.
- Adding works offline; editing and deleting need a connection.
- Sending the same new transaction twice saves it once.
- Quick capture saves nothing until you confirm.
- Deleting a category that entries are filed under hides it; the entries keep it.

## Add a transaction

1. Open **Finance**. The add form is on the **Overview** tab.
2. Pick the kind: **Income**, **Expense** or **Transfer**.
3. Type the amount. It formats as you type: `100000` becomes `100.000`.
4. Pick the account. For a transfer, also pick **To account**.
5. Optionally pick a category, a merchant and a date. For income or expense, the **Debt** field can name a person from your contacts; leave it on **Not a debt** otherwise.
6. Press **Add**.

To pay a contact at the same time as recording the expense, use **Send money**
instead — see [Sending money](./sending-money.md).

## Add a transaction with no signal

1. Open `/finance` once while you have a connection, so the page is kept on the device.
2. Later, with no network, open **Finance** and add the expense as usual.
3. The entry is held on the device and shown above the ledger as waiting: *Saved on this phone. It will go up when you have a connection.*
4. When the connection comes back it is sent on its own, and a toast says how many transactions went up.

If the phone has no room to keep it, the app says so; try again when you have a
connection.

## Type spending as a sentence

1. In the capture box, write what you spent the way you would say it, for example *"banh mi 30k this morning, coffee 25k, lunch 55k"*.
2. Press **Preview**. The sentence is read and turned into proposed transactions.
3. Check each row. Remove any you do not want, fix an amount, or pick the **Account** they go into.
4. Press **Save**. Nothing has been recorded until you do; **Discard** throws the proposal away.

The same review step is used by the global quick-capture box (`⌘J`): type `/`
and pick **Finance**, or, when the assistant answers a message that had an
amount in it, press **File as spending**. See
[Quick capture and the assistant](../assistant.md).

## Find a transaction

1. On the **Overview** tab, use the search box above the ledger — it matches where the money went, who to, or a code.
2. Narrow the ledger by **Account**, by **Category** (including **No category**), or by a date range with **From** and **To**. On a phone these sit behind **Filters**.
3. **Still to transfer** shows only the payments you have not yet confirmed as sent — see [Sending money](./sending-money.md).
4. **Clear filters** brings the full ledger back.

## Edit or delete a transaction

1. Find the row in the ledger.
2. Open it to change its kind, amount, accounts, category, debt, merchant or date — or delete it. A toast confirms the deletion.

Both need a connection.

## Manage categories

1. Go to the **Accounts** tab.
2. Press **New category**, name it, and say whether it is for income or expense.
3. Optionally fill in **Note for AI**: describe what belongs in the category, so quick capture can pick it more accurately.
4. To remove a category, delete it. If anything is filed under it, it is hidden instead and those entries keep it.

## How it works

**Kinds.** Income and expense are what the totals, the budgets and the report
count. A transfer moves money between your own accounts, so it changes two
balances and counts as neither — moving money from the bank to your wallet is
not spending it.

**Offline, the way the daily log does it.** Adding a transaction works offline
with the same mechanism as the [daily log](../daily-log.md). Only *adding*:
editing and deleting still need a connection, because two devices changing the
same row would need a rule for which change wins, and adding does not. Quick
capture needs a connection too — it asks a model to read your sentence, and
there is nothing to queue.

**Sending twice is harmless.** The id of a new transaction is decided by the
browser before the first attempt, so a retry after a reply that never arrived
lands on the same row rather than charging the coffee again. This is the piece
the daily log got for free from its date (one log per day), and the reason
finance came second.

**Hiding instead of deleting.** An account or category that something is filed
under is hidden when you delete it, and the entries keep it, so old
transactions never lose what they were filed as.

## Limits

- Editing and deleting cannot be done offline.
- Quick capture cannot be used offline or without the AI service.

## Related

- [Finance overview](./overview.md) — the four tabs and how the pieces fit
- [Accounts and debts](./accounts-and-debts.md) — the accounts transactions sit in, and how naming a person makes a debt
- [Budgets](./budgets.md) — expense transactions are what a budget measures
- [Report](./report.md) — what the transactions add up to
- [Sending money](./sending-money.md) — record an expense and pay the person in one step
- [Quick capture and the assistant](../assistant.md) — file a sentence as spending from anywhere in the app; **File as spending** turns an answer into transactions
- [People](../people.md) — the contacts a transaction can name
- [Daily log](../daily-log.md) — the offline queue finance shares
- [Notifications](../notifications.md) — a transaction dated today keeps the evening reminder away
- [Data model: finance](../../reference/data-model/finance.md) — tables behind this page
