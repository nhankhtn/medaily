---
title: Daily log
description: One entry per day of what actually happened — energy, sleep, study, deep work and the rest — and the record every other page is built from.
sidebar_position: 2
---

# Daily log

The daily log is the spine of the app: one entry per day, editable for any past day. Fill what you care about and press Save. Four fields carry most of the value — energy, sleep, study time and deep work — and the rest is optional. Habits, goals, streaks, the score and analytics are all built from it.

| | |
| --- | --- |
| **Where** | `/daily` · `/daily/<date>` · `/daily/catch-up` · sidebar → Core → Daily log · phone dock → Log · header → **Today** |
| **Works offline** | Yes, once the app has been opened with a connection |
| **Needs** | Nothing extra |

## Rules

- One entry per day. Any past day can be edited; a future day cannot be logged — planning belongs in the [Calendar](./calendar.md).
- The daily log records what happened, never what you meant to do.
- A blank field means *not recorded*, never zero. A skipped day does not drag an average down.
- When focus sessions exist for a day, they decide its study and deep-work minutes — the number every other page reads.
- A day whose minutes add up to more than 20 hours gets a warning, and still saves as entered.
- Saving the same day twice replaces that day's entry; it never adds a second one.
- Turning a field off hides it from the form but deletes nothing; a day that already has a value still shows it.
- Habits and goals that read a field stop counting when that field is turned off.
- Removing your own activity hides it from the form; days already logged keep their values.
- Signing out clears days still waiting to be sent from the device.

## Log a day

1. Open **Daily log** (or press **Today** in the header, or **Log** in the phone dock).
2. Fill the fields you care about. Energy, sleep, study time and deep work matter most; the rest is optional.
   - Minute fields offer preset chips and a **+15** button, and show your 14-day median as a faint hint.
   - The win, problem, tomorrow's priority and note fields use the same editor as notes; see [Editor](./editor.md).
3. Press **Save** — or press `S`, when you are on the daily log and not in a text field.
4. To take the save back, press **Undo** on the toast. The day goes back the way it was.

The quickest version is on the [dashboard](./dashboard.md): while today is still blank, a two-tap quick log takes energy and sleep. You can also log one number from anywhere with the [command palette](../get-started/navigation.md#log-a-number-for-today), for example `sleep 7.5`.

## Open another day

1. Press `[` to go back a day and `]` to go forward. Press `T` to return to today. These keys work on this page only.
2. Or open `/daily/2026-09-01` to go straight to one day. A date still in the future goes back to today.
3. Or type a date like `2026-09-01` into the command palette (`⌘K`).

## Copy yesterday

1. Press **Copy yesterday**. The form fills from the previous entry.
2. Change what was different today. Copied fields stay highlighted until you touch them, so you can see what you have not checked.
3. Press **Save**.

## Delete a day

1. Open the day.
2. Press **Delete**. The day's entry is removed.

## Catch up on missed days

When two or more of the last seven days are missing, a banner offers **Catch-up**.

1. Press **Catch-up** on the banner, or open `/daily/catch-up`.
2. Fill the rows. There is one row per missing day from the last two weeks.
3. Save. All the rows are saved in one go.

## Log with no signal

The daily log works offline, because it is the screen you reach for in a lift or on a metro.

1. Open the app once with a connection. It keeps a copy of the page.
2. Later, with no network, open `/daily`. The form appears instead of a browser error.
3. Fill it and press **Save**. The day is kept on the device, and the toast says so rather than claiming it was saved.
4. Do nothing else. The day goes up on its own the next time the app has a connection, on whatever screen you happen to be on, and a second toast says how many days went.

Adding a transaction and stopping the timer also work offline; see [Transactions](./finance/transactions.md) and [Timer](./timer.md). Every other screen needs a connection.

> **Important:** Signing out clears every day still waiting to be sent. Get a connection before you sign out on a device with days waiting.

## Choose which fields the form asks

1. Press **Set up**, beside the date.
2. Under **What the day log asks**, turn off the built-in fields you never fill. Each one says how many habits and goals read it, since those stop counting when it is off.
3. Close the panel. The form no longer asks those fields.

Nothing is deleted. A day that already has a value still shows the field, so nothing you recorded goes out of sight.

## Add your own activity

The built-in fields are not the ceiling.

1. Press **Set up** → **New activity**.
2. Give it a name in both languages. The key fills itself from the English name and stays editable.
3. Pick a kind: **number**, **minutes**, **scale 1–10**, **yes/no**, or **text**.
4. Add a unit if it helps.
5. Save. The activity appears on the daily log under **Your own**.

A [habit](./habits.md) or a [goal](./goals.md) can bind to it exactly like a built-in metric. **Minutes** is the kind that earns more than an input box: the [timer](./timer.md) offers it alongside the built-in activities, so an activity you invented can be timed like any other.

To remove one, open **Set up** and remove it. It disappears from the form; the days already logged keep their values.

## How it works

**The past, not the plan.** The daily log never holds intent; that is what the [Calendar](./calendar.md)'s day view, planned blocks and tasks are for. Mixing them would mean "what I meant to do" and "what I did" could never be compared. That is also why a future date sends you back to today: a day that has not happened has nothing to record. The one forward-looking field, tomorrow's priority, is read by the next day's Calendar view rather than planned here.

**Entered once.** When [focus sessions](./timer.md) exist for the day, study and deep work show what they add up to — "45 min from 2 focus sessions". The sessions decide the number every other page reads, so a number typed by hand and a number counted by the timer can never disagree. Sessions win whenever any exist for that kind — learning sessions for study, deep-work and project sessions for deep work — and the typed number is the fallback, never added on top. A day with a timed session counts as a day even if nothing was typed into it.

**Timer runs that add to the log.** A [timer](./timer.md) run timed as English, reading or entertainment is added onto that day's log, and a run on one of your own minute activities is added onto that day's value for it.

**Blank is not zero.** An empty field is *not recorded*, never zero. A skipped day does not drag an average down, so a day you did not fill does not look like a bad day.

**Drafts.** What you type is kept on the device as a draft. Leave without saving and the page asks first; come back and the draft is restored, with a toast saying so.

**Why offline starts here.** Sending the same day twice is harmless: the write replaces the row for that date rather than adding one. That is what made the daily log the safe place to start. A day held on the device is dropped from the queue if the server ever refuses it outright, so a bad entry cannot block the good ones behind it.

**Signing out.** Signing out clears everything of yours the device is holding: the cached page, anything still waiting to be sent, and the drafts of days you typed but never saved. All three are your own day in a different state, and none should be there for whoever signs in next — an unsent day would land in their account, and a draft would reappear in their form.

**Why Set up is on the form.** The two lists live on the form rather than in Settings because the moment you want them is the moment you are looking at the form.

**What "today" is.** Which day counts as today comes from **Settings → Timezone** and the **day rollover hour**: anything logged before that hour belongs to the previous day. See [Settings](./settings.md).

## Limits

- Only the daily log, adding a transaction and stopping the timer work offline.
- A day refused by the server while offline is dropped, not retried.
- Days waiting to be sent are lost if you sign out before they go up.

## Related

- [Timer](./timer.md) — focus sessions decide study and deep-work minutes; your own **minutes** activities can be timed
- [Habits](./habits.md) — a habit bound to a field ticks itself when you log the day; turning a field off stops it counting
- [Goals](./goals.md) — metric goals total a daily field over a window
- [Dashboard](./dashboard.md) — the two-tap quick log, and the numbers, streaks and score built from the log
- [Calendar](./calendar.md) — where plans live; the day view shows the priority you wrote on yesterday's log
- [Analytics](./analytics.md) and [Reviews](./reviews.md) — the longer view over these days
- [Assistant](./assistant.md) — **Looking back** reads the wins and problems you wrote on the log
- [Editor](./editor.md) — the editor behind the win, problem, priority and note fields
- [Transactions](./finance/transactions.md) — the other screen that saves offline
- [Notifications](./notifications.md) — the evening reminder when nothing is logged today
- [Settings](./settings.md) — timezone, day rollover hour, and exporting the daily logs as CSV
- [Navigation](../get-started/navigation.md) — logging a number from the command palette
- [Keyboard shortcuts](../get-started/keyboard-shortcuts.md) — `[`, `]`, `T` and `S`, and how to change them
- [First days](../get-started/first-days.md) — "Log today" and "Log three days" on the checklist
- [Data model: daily log](../reference/data-model/daily-log.md) — `daily_logs`, custom metrics and `v_daily_effective`
