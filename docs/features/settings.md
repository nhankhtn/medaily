---
title: Settings
description: Your profile, language and theme, the day rollover hour, week start, streak grace, score weights, your data, support and deleting the account.
sidebar_position: 20
---

# Settings

Settings is where you decide how the app counts: when a day ends, which day a week starts on, whether one missed day breaks a streak, and what the day score weighs. It is also where you change your photo, language and theme, export or import your data, see what changed lately, send a note to whoever runs the instance, and delete the account.

| | |
| --- | --- |
| **Where** | `/settings` · sidebar → Insight · phone → **More** · `g` then `s` |
| **Works offline** | No |
| **Needs** | Nothing extra. Some parts need a service: profile photo (Cloudinary), **See history** / What changed (`MONGODB_URI`), **Get in touch** (Telegram) — see [Configuration](../operations/configuration.md) |

## Rules

- Language and theme apply at once, everywhere.
- Anything logged before the **day rollover hour** belongs to the previous day.
- Changing the timezone only changes what counts as today; past entries keep the date they were recorded with.
- **Week starts on** Monday or Sunday, and that drives every weekly range in the app.
- With **Grace day for streaks** on, one missed day inside a week pauses a streak instead of breaking it.
- **Score weights** must add up to 100%.
- A profile photo must be under 5 MB.
- Your own activities, and which built-in fields the daily log asks, are set under **Set up** on the daily log, not here.
- Importing runs a dry run first and reports what would be created before anything is written.
- **What changed** keeps the last `ACTIVITY_LOG_DAYS` days — 90 unless configured.
- Ticking a habit, saving a day's log and writing in the journal are not recorded in **What changed**.
- **Get in touch** stores nothing; the note goes to Telegram and nowhere else. Four notes an hour from one place.
- Deleting the account cannot be undone, and no copy is kept.

## Find your way around the page

From the top:

- **Profile** — your photo (change or remove it, under 5 MB; needs Cloudinary), how you signed in, and since when. **See history** opens [What changed](#see-what-changed).
- **Language** (English or Vietnamese) and **theme** (Light, Dark or Pink), applied at once; **Show the introduction again** replays the tour.
- **Add to home screen**, where the browser can do it and the app is not installed yet.
- **Notifications** — turn notifications on for this device; see [Notifications](./notifications.md).
- **Day rollover hour** (and the timezone behind it).
- **Week starts on** Monday or Sunday.
- **Grace day for streaks**.
- **Score weights**, with a reset to the defaults.
- **Keyboard shortcuts** — not shown on a phone.
- **Your data**.
- **Get in touch**, where a support channel is configured.
- **Delete this account**.

Changes to the rollover hour, week start and grace day save as you make them, and a toast says **Settings saved**.

## Change your profile photo

1. Under **Profile**, choose to change your photo.
2. Pick an image under 5 MB. It needs Cloudinary; without it, the card says storage is not set up.
3. To take it down, choose to remove it.

## Change the language or theme

1. Under **Language**, pick English or Vietnamese.
2. Pick a theme: Light, Dark or Pink.

Both apply at once. On a computer the header also carries language and theme switches; on a phone they are only here.

## Replay the introduction

Press **Show the introduction again** to replay the eight-step tour from [First days](../get-started/first-days.md).

## Add the app to your home screen

1. Where the browser can install the app and it is not installed yet, press **Add to home screen**.
2. On an iPhone, Safari has no button for it, so this card shows the two taps instead.

Installed, the app opens without the address bar, and anything saved offline is safe from being cleared.

## Set when your day ends

1. Under **Day rollover hour**, pick the hour.
2. Anything logged before that hour now belongs to the previous day — so a log written at 01:00 counts for the day you are still living.

## Choose the first day of the week

1. Under **Week starts on**, pick **Monday** or **Sunday**.

## Keep a streak through one missed day

1. Turn on **Grace day for streaks**.
2. One missed day inside a week now pauses a streak instead of breaking it; the streak shows as held rather than broken.

## Change what the day score weighs

1. Under **Score weights**, adjust the weights. They must add up to 100%; saving stays off until they do.
2. Save. **Reset to defaults** puts them back.

## Export or import your data

1. Open **Your data**.
2. Export everything as JSON, or the daily logs as CSV.
3. To import, choose a file. A dry run reports what would be created before anything is written; confirm to write it.

## See what changed

1. Under **Profile**, press **See history**.
2. Read the trail of what was added, changed, archived or deleted lately.

## Send a note to whoever runs the instance

1. Under **Get in touch**, press the button and write your note — something broken, something missing.
2. Send. It goes straight to whoever runs the instance, over Telegram, and carries who sent it.

## Delete your account

1. Take an export under **Your data** first, if you want one.
2. Under **Delete this account**, start the deletion.
3. To confirm, type the name the dialog shows: your username, or the Google address you signed in with.
4. Confirm. Everything under the account is removed — the journal, the ledger, the health log, the people and the photos — with no undo and no copy kept.

## How it works

**The clock.** The day rollover hour exists because a log written at 01:00 belongs to the day you have not finished yet; the default is 4. The timezone decides what counts as today; changing it only changes that, and past entries keep the date they were recorded with. Together they decide which day the [Daily log](./daily-log.md), the [Timer](./timer.md) and the evening reminder in [Notifications](./notifications.md) treat as today.

> **Note:** The timezone is still a setting (default `Asia/Ho_Chi_Minh`), but its control is currently hidden on the Settings page, so it cannot be changed from the UI.

**The week.** **Week starts on** drives every weekly range: the dashboard's *This week*, weekly habits' counts and the grace day, weekly reviews, the calendar's week, and analytics.

**Streaks.** The grace day applies to habit streaks and the dashboard's streaks alike: one missed day inside a week pauses a streak instead of breaking it.

**The score.** The dashboard's day and week score, and the period score on Reviews, are built from these weights. They are merged over the defaults when read, so a partly saved set can never leave a part without a target. The score is an operational signal, not a measure of anyone's worth.

**What lives elsewhere.** Your own activities, and which built-in fields the daily log asks, are under **Set up** on the daily log rather than here — the moment you want them is the moment you are looking at the form. Keyboard shortcuts are edited from this page on a computer; the shortcut list is a keyboard's business, so Settings does not offer it on a phone.

**Your data.** The export endpoint also gives CSV for other tables (`/api/export?format=csv&table=…`), though only the daily logs have a button. For a real backup of the database itself there is `scripts/backup.sh`.

### What changed

A trail of what was added, changed, archived or deleted lately: transactions, accounts and categories; habits, goals, notes and people; chat rooms (made, joined, left, invites, removals, renames, deletions); and signing in and out. Only the last `ACTIVITY_LOG_DAYS` days are kept — 90 unless configured — and it needs `MONGODB_URI`. Without it there is no What changed and no **See history**.

It deliberately stops there. Ticking a habit, saving a day's log and writing in the journal are not recorded: a trail that records every habit ticked buries the entries anyone actually goes looking for, and those are the ones about access and about money.

### Get in touch

**Get in touch** sends a note straight to whoever runs the instance, over Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`). A signed-in note carries who sent it. On `/welcome`, where nobody is signed in, the **Contact** link opens the same form with a field for where to answer; left blank, the note goes one way. Nothing is stored: it goes to the chat and nowhere else. Four notes an hour from one place. Without Telegram configured, the form is not offered, in Settings or on `/welcome`.

## Limits

- The timezone cannot currently be changed from the page.
- Only the daily logs have a CSV export button; other tables need the export address.
- **What changed** needs `MONGODB_URI` and keeps only the configured number of days.
- Account deletion has no undo.

## Related

- [Daily log](./daily-log.md) — the rollover hour decides which day a log belongs to; **Set up** holds your own activities and the fields the form asks
- [Habits](./habits.md) — **Grace day for streaks** and **Week starts on** shape streaks and weekly counts
- [Dashboard](./dashboard.md) — **Score weights** set the day and week score; streaks follow the grace day
- [Reviews](./reviews.md) — weekly periods follow **Week starts on**; the period score uses the weights
- [Calendar](./calendar.md) — the week view starts on the day you choose
- [Analytics](./analytics.md) — weekly ranges and which day a value falls on
- [Notifications](./notifications.md) — the **Notifications** card turns them on per device; the evening reminder uses your timezone and rollover hour
- [First days](../get-started/first-days.md) — **Show the introduction again** replays the tour; **Add to home screen**
- [Sign-in](../get-started/sign-in.md) — how you signed in; the **Contact** link on `/welcome` opens **Get in touch**
- [Navigation](../get-started/navigation.md) — on a phone, language and theme are only here
- [Keyboard shortcuts](../get-started/keyboard-shortcuts.md) — opened from here on a computer
- [Chat](./chat/overview.md) — room changes appear in **What changed**
- [Finance: overview](./finance/overview.md) — transactions, accounts and categories appear in **What changed**
- [Configuration](../operations/configuration.md) — `CLOUDINARY_*`, `MONGODB_URI`, `ACTIVITY_LOG_DAYS`, Telegram
- [Data model: core](../reference/data-model/core.md) — `users` and `user_settings`
- [Data model: activity trail](../reference/data-model/activity-trail.md) — the Mongo `activity` collection behind **What changed**
