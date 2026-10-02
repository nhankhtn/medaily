---
title: Scheduled jobs
description: The two scheduled routes — the nightly run that carries budgets forward and cleans up, and the evening reminder — and how they are protected.
sidebar_position: 2
---

# Scheduled jobs

Two jobs run on a schedule. The **nightly run** carries budgets into a new
month, clears pictures nothing refers to, and sweeps leftover live-update
channels. The **evening reminder** sends one notification to everybody whose
day is still blank. Both are plain routes that a scheduler calls with a secret.

| Route | Schedule (`vercel.json`) | Local time in Vietnam | Does |
| --- | --- | --- | --- |
| `/api/cron/nightly` | `0 17 * * *` — 17:00 UTC | Midnight | Budgets forward, unused pictures, live-update channels |
| `/api/cron/reminders` | `0 13 * * *` — 13:00 UTC | 8 in the evening (lands 20:00–20:59) | **Nothing logged today** notification |

## Rules

- Both routes need `CRON_SECRET`, sent as `Authorization: Bearer $CRON_SECRET`.
- Without `CRON_SECRET` set, both answer `503` and do nothing.
- With a wrong or missing header, both answer `401`.
- The nightly run does three things, in this order, for every account: carry budgets forward, clear unused pictures, sweep live-update channels.
- One failing account does not stop the others.
- A Telegram report is sent only on a night when something was copied or deleted, or something failed.
- Budgets are only ever carried into the month now running, and only into a month that has none.
- A picture is only cleared once it is old enough that nobody can still be writing the note it was meant for.
- The evening reminder goes only to people whose day has no daily log **and** no transaction dated on it, and only to devices with notifications on.

## Turn the jobs on

1. Set `CRON_SECRET` on the deployment to a long random value.
2. Keep the two entries in `vercel.json` (or point any scheduler at the two routes with the same header).
3. Optionally set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to receive the nightly report.
4. For the evening reminder, also configure push notifications — see [Configuration](./configuration.md).

## Run a job by hand

1. Call the route with the secret:

   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>/api/cron/nightly
   curl -H "Authorization: Bearer $CRON_SECRET" https://<your-app>/api/cron/reminders
   ```

2. Running either twice is safe: the budget copy writes nothing the second time, and a second reminder replaces the first on the lock screen instead of stacking.

## How it works

### Protection

The routes sit outside the sign-in gate, since the scheduler has no session, so
the secret is the only thing guarding them. Without `CRON_SECRET` they answer
503 and do nothing, and with a wrong or missing header they answer 401. The
header is compared in constant time, so the response time says nothing about
how much of the secret matched, and every refusal is logged.

### The nightly run — `/api/cron/nightly`

Once a day, at 17:00 UTC — midnight in Vietnam — it does three things, in this
order, for every account:

1. **Carries budgets forward** into a month that has none — see
   [Budgets](../features/finance/budgets.md). Cheap, and the one somebody
   notices missing — without it the budget tab is blank on the first of the
   month — so it goes first.
2. **Clears pictures nothing refers to.** A picture pasted into a note and later
   deleted, or never saved, is removed from Cloudinary once it is old enough
   (a day) that nobody can still be writing the note it was meant for. This one
   lists a Cloudinary folder and reads every text column the account owns, so
   it is the one that might run long enough to be cut off; second place means
   being cut off costs a night rather than a month.
3. **Sweeps leftover live-update channels** for chat — see
   [Housekeeping](../reference/realtime/housekeeping.md). Nobody is waiting for
   it, so it goes last; cut off, it finishes tomorrow.

The steps run one after another rather than together, which is what the order
is for: run together, a timeout would cut whichever happened to be unfinished.
One failing account does not stop the others.

**The report.** A report goes to Telegram only on a night when something was
copied or deleted, or something failed — a message every quiet night is how a
channel stops being read, and the same channel carries the failures. The
report is written in Vietnamese.

**One schedule, not three.** Hobby cron jobs fire once a day and only to the
nearest hour anyway, so separate schedules would buy no precision — only a
second route, a second secret check and a second message on the phone.

### The evening reminder — `/api/cron/reminders`

A second schedule, at 13:00 UTC — 8 in the evening in Vietnam. Hobby cron fires
anywhere inside the hour, so it lands between 20:00 and 20:59. Same secret, same
503 and 401 as the overnight run.

It sends one notification, **Nothing logged today**, to everybody whose day is
still blank: no daily log for it **and** no transaction dated on it. Either one
is enough to be left alone. Tapping the notification opens the daily log.

- Only devices with notifications turned on in **Settings → Notifications** are reached; there is no separate switch. Turning a device off turns this off for it too.
- "Today" is each person's own, from their timezone and day rollover hour. At 20:00 somebody whose day turns over at 22:00 is still on yesterday, and is asked about yesterday.
- A transaction counts by the date it is filed under, not when it was typed: last week's coffee entered tonight does not count for today.
- Every reminder carries the same tag, so a second one — a retried run, or tomorrow's — replaces the one still on the lock screen instead of stacking.
- The words follow the person's language setting.

The route answers with a summary of the run as JSON, or `500` if the run
failed.

## Limits

- Timing is to the hour: Vercel Hobby cron fires anywhere inside the scheduled hour.
- Without `CRON_SECRET`, neither job runs; **Copy last month** on the Budgets tab is the manual fallback for budgets, and there is none for the reminder.

> **Note:** The comment above `CRON_SECRET` in `.env.example` still names
> `/api/cron/sweep-images`. That route no longer exists; the picture sweep is
> step 2 of `/api/cron/nightly`.

## Related

- [Budgets](../features/finance/budgets.md) — what the carry-forward does, and **Copy last month**
- [Notifications](../features/notifications.md) — turning on the devices the reminder reaches
- [Daily log](../features/daily-log.md) — logging the day keeps the reminder away, and the reminder opens it
- [Transactions](../features/finance/transactions.md) — a transaction dated today keeps the reminder away too
- [Editor](../features/editor.md) — where the pictures the nightly run clears come from
- [Settings](../features/settings.md) — timezone, day rollover and language, which decide "today" and the words
- [Housekeeping](../reference/realtime/housekeeping.md) — the live-update channel sweep in detail
- [Configuration](./configuration.md) — `CRON_SECRET`, `TELEGRAM_*`, Cloudinary and push variables
- [Data model: finance](../reference/data-model/finance.md) — the budgets the run copies
- [Data model: core](../reference/data-model/core.md) — `push_devices`, the devices the reminder reaches
