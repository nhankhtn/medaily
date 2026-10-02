---
title: Finance report
description: See balances over time, where the money went by category, and how a month or year compares with normal.
sidebar_position: 6
---

# Finance report

The **Report** tab is what the numbers add up to: how your balance moved,
where the spending went, and whether a month or a year was ordinary or not.

| | |
| --- | --- |
| **Where** | `/finance?tab=report` · a period is linkable: `/finance?tab=report&period=2026-09` or `&period=2026` |
| **Works offline** | No |
| **Needs** | Nothing extra |

## Rules

- **Balance over time** covers the last 30, 90 or 180 days, for one account or all of them.
- The period is a month, or a whole year, and it is kept in the address.
- A month is drawn with the five months before it; a whole year is drawn as its twelve months.
- Spending by category shows at most eight categories; the rest are folded into one **Other** slice.
- Spending with no category and the folded **Other** are separate rows.
- A month is compared with a normal month: the average of months that have something recorded, leaving out the chosen month and the month now running.
- A whole year is compared with the year before.
- With nothing to compare against, the report says so instead of showing a figure.
- **Kept** is the share of income left over; with no income it shows `—`, not 0%.
- Debts and transfers are not spending and do not appear in the report.

## Check your balance over time

1. Open **Finance** → **Report**. **Balance over time** comes first.
2. Pick **30**, **90** or **180** days.
3. Pick one account, or **All accounts**.

## Pick a period

1. Use the two selects at the top: a **Year**, and a **Month** within it or **Whole year**.
2. The address changes to match, for example `/finance?tab=report&period=2026-09` for a month or `&period=2026` for a year.
3. Copy the address to link to that period. The back button walks back through the periods you looked at.

## Read the report

- **Where it went** — spending by category as a ring, biggest slice first, with the total in the hole and a ranking beside it in the same colours. The dot on each row is its slice.
- **The comparison** — a month against what a normal month costs, or a year against the year before.
- **Kept** — the share of what came in that was left over.

## How it works

**Context around a month.** A month is drawn with the five months before it for
context; a whole year is drawn as its twelve months.

**Why eight slices.** Past eight categories the tail is folded into one *Other*
slice, because a pie of twenty slivers answers nothing. Spending with no
category at all and the folded *Other* are different rows and say so.

**What a normal month is.** A month is compared against what a normal month
costs, counting only months that have something recorded. The chosen month is
left out of its own average, and so is the month now running, since it is not
over yet; a month from before you started recording is not a month you spent
nothing in.

**Why a year is compared with last year.** A whole year has no monthly average
of its own to be held up against, so it is compared against the year before
instead. With nothing to compare against — your first month or first year with
anything in it — the report says so rather than showing a figure.

**Why `—` and not 0%.** "Kept" is the share of income left over. With no income
recorded there is no share to give, so it shows `—` rather than 0%, which would
read as breaking even.

**An empty period.** A period with nothing in it says so and leaves the selects
in place, since picking another one is the way out.

**What is left out.** Money you lend is not money you spent, so
[debts](./accounts-and-debts.md) are left out of the report, as are transfers
between your own accounts.

## Related

- [Transactions](./transactions.md) — what the report adds up
- [Budgets](./budgets.md) — the limits the same spending is measured against month by month
- [Accounts and debts](./accounts-and-debts.md) — the accounts behind **Balance over time**, and why debts are excluded
- [Finance overview](./overview.md) — this month's income and expense against last month's, on the Overview tab
- [Quick capture and the assistant](../assistant.md) — ask *What did I spend this month?* in your own words instead
- [Data model: finance](../../reference/data-model/finance.md) — tables behind this page
