---
title: Budgets
description: Set a monthly spending limit per category, see the month's total, and have each new month start from last month's limits.
sidebar_position: 4
---

# Budgets

A budget is a monthly limit for one expense category. The Budgets tab shows one
month at a time, how much you have spent against each limit, and the total you
allowed yourself — so "how much did I allow myself this month" has an answer
without adding up rows.

| | |
| --- | --- |
| **Where** | `/finance` → **Budgets** tab |
| **Works offline** | No |
| **Needs** | At least one expense category. The automatic carry-forward needs `CRON_SECRET` — see [Configuration](../../operations/configuration.md); **Copy last month** works without it |

## Rules

- A budget is a monthly limit for one category.
- Spending against a budget is the month's expense transactions in that category. Debts and transfers do not count.
- The tab totals every budget in the month under **All budgets**.
- You can move back to any past month, but forward no further than the month now running.
- A new month starts with last month's budgets: the nightly job copies them into the running month if it has none.
- Setting even one figure in a month first counts as handling it yourself; nothing is copied over it.
- A running month that is still empty offers **Copy last month**, which does the same copy on the spot.
- You can set or change a budget on a past month.
- Nothing is ever copied into a past month.

## Set a budget

1. Go to **Finance** → **Budgets**.
2. Press **Set budget**.
3. Pick the category and type the monthly amount.
4. Save.

If you have no categories yet, the tab asks you to create an expense category
first — see [Transactions](./transactions.md#manage-categories).

## Change a budget

1. Click the budget's name.
2. Type the new amount and save.

## Look at another month

1. Use the arrows beside the month name.
2. **Previous month** goes back as far as you like. **Next month** stops at the month now running.
3. On a past month you can still set or change budgets — usually to work out what it should have been.

## Start a month by hand

1. Open the **Budgets** tab on the month now running.
2. If it has no budgets yet and last month had some, press **Copy last month**.
3. Last month's limits are copied in — a toast says how many — and you can change any of them.

## How it works

**Carrying forward.** The [nightly job](../../operations/scheduled-jobs.md)
checks, for every account, whether the month now running has any budget yet,
and if it has none, copies last month's in. It is the first thing the job does,
because it is cheap and it is the one somebody notices missing. A current month
that is still empty — the job has not run yet, or is not set up — offers
**Copy last month**, which does the same thing on the spot.

**Safe to run twice.** The copy ignores rows that already exist, so running it
twice writes nothing the second time. That is what lets it be checked daily
instead of being timed to midnight in a timezone — and it uses each person's
own month, not the server's.

**Why copy at all.** Almost nobody rewrites their budget each month; what they
want is last month's, with the one or two lines that changed. A month you have never opened therefore still has limits
to go over, which is the only way the overspending it reports means anything.

**Why a figure you set stops the copy.** Setting even one figure for the month
first counts as handling it yourself, and nothing is copied over it.

**Why past months are editable but never filled.** You can move back to any
past month and see how it ended — and set a budget on a month already gone,
because the reason to look at one is usually to work out what it should have
been. Nothing is ever copied into a past month, so it keeps showing what was
actually set.

**Why the limit is forward-bounded.** The arrows move back as far as you like,
but no further forward than the month now running. "The month now running" is
yours: it follows your timezone and day rollover hour from
[Settings](../settings.md).

**What counts as spent.** Expense transactions filed under the budget's
category in that month. Money lent to someone is a [debt](./accounts-and-debts.md),
not spending, so it never uses up a budget.

## Limits

- Budgets are per category per month; there is no weekly or yearly budget.
- Without `CRON_SECRET` nothing is carried forward on its own; use **Copy last month**.

## Related

- [Finance overview](./overview.md) — the four tabs
- [Transactions](./transactions.md) — expense transactions are what a budget measures, and where categories are made
- [Accounts and debts](./accounts-and-debts.md) — why lending does not count as spending
- [Report](./report.md) — spending by category over a month or a year
- [Scheduled jobs](../../operations/scheduled-jobs.md) — the nightly run that carries budgets forward
- [Configuration](../../operations/configuration.md) — `CRON_SECRET`
- [Settings](../settings.md) — timezone and day rollover, which decide the current month
- [Data model: finance](../../reference/data-model/finance.md) — tables behind this page
