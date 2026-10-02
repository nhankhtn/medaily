---
title: Timer
description: Time a run of learning, deep work, a project, exercise or one of your own activities, and have it filed into the right place when it ends.
sidebar_position: 7
---

# Timer

The timer is how time gets into the app without being typed. You choose what you are doing, press **Start**, and when you stop, the run is filed where it belongs — a focus session, a workout, or minutes on that day's log. It keeps going with no signal, and it follows you around the app while it runs.

| | |
| --- | --- |
| **Where** | `/timer` · sidebar → Core · phone dock → **Timer** · the running clock in the header on every page |
| **Works offline** | Yes — a run keeps going and can be stopped with no connection |
| **Needs** | Nothing extra |

## Rules

- What you time decides where the run is filed:
  - **Learning**, **deep work** and **project** become a focus session, which makes up the day's study or deep-work minutes.
  - **Exercise** becomes a workout under Health, with its type.
  - **English**, **reading** and **entertainment** are added onto that day's log.
  - One of **your own** minute-measured activities is added onto that day's value for it.
- A run under 30 seconds is discarded rather than recorded.
- A run left going is capped at 8 hours.
- Only one run goes at a time. Starting a new run while one is going saves the running one first, and tells you where it went.
- A run stopped with no connection is kept on the device and uploads the next time the app is online.
- Time is entered once: when a day has focus sessions, they decide that day's study and deep-work minutes, in place of what was typed into the log.
- Signing out clears runs still waiting on the device.

## Start a run

1. Open **Timer**.
2. Choose what you are timing: learning, deep work, project, English, reading, exercise, entertainment, or one of your own minute-measured activities.
3. Choose to count up or count down.
4. Say what it is for — for example the topic you are learning, or the project you are working on.
5. Press **Start**. On the timer page, `Space` starts and pauses as well.

You can also start a learning, deep-work or project run from the **Timer** card on [Learning](./learning.md) without leaving that page.

## Keep track of a run

- The badge in the header shows the running clock on every page.
- The browser tab title carries the clock, so another tab still shows the run.
- The screen is kept awake while a run is going.
- Press `Space` on the timer page, or the pause control, to pause and resume.

## Stop and file a run

1. Stop the run.
2. The run is filed according to what you chose (see [Rules](#rules)), and the toast says where it went.

To time a project's work, choose **Project** and pick the project; its time spent on [Projects](./projects.md) is the sum of those sessions.

## Use the timer with no signal

1. Start a run as usual. It is timed on the device, so it keeps going with no connection.
2. Stop it. With no connection the run is kept on the device, and the toast says so rather than claiming it was filed.
3. The next time the app is online — on any screen — the waiting runs upload, and a toast says how many went up.

## How it works

**A fact is entered once.** A timed session becomes the day's study minutes; a project's time spent is the sum of sessions attributed to it. That is why the timer files runs instead of asking you to copy numbers anywhere. When focus sessions exist for a day, the [Daily log](./daily-log.md) shows what they add up to — "45 min from 2 focus sessions" — and the sessions decide the number every other page reads.

**Where each kind lands.** Learning, deep work and project share one shape — a focus session with a date, minutes, a kind, and optional topic, project and task — so one query path serves them all. Exercise becomes a workout, with its type, on [Health](./health.md), which in turn copies the minutes into the day's exercise field. English, reading and entertainment are plain daily-log fields, so the run is added onto that field. An activity you created yourself under **Set up → New activity** on the daily log with the kind **Minutes** is offered here alongside the built-in ones, so an activity you invented can be timed like any other; its run is added onto that day's value for it.

**One run at a time.** The server holds at most one running timer per user, with the time banked before the current stretch so pausing loses nothing. Starting another run saves the first rather than throwing it away.

**Offline, and why a retry cannot count twice.** A run stopped offline is queued on the device and may be sent more than once when the connection returns. Each completed run carries an id chosen on the device; the server claims that id before filing, so a retry finds the claim and files nothing, and daily minutes cannot be counted twice. If filing fails, the claim is released so the queue can try again. Adding a transaction and the daily log itself work offline the same way; every other screen needs a connection.

**Signing out** clears anything of yours still waiting on the device, so sign out with runs still queued and those runs are gone — get a connection first.

## Limits

- Runs shorter than 30 seconds are not recorded.
- A forgotten run stops counting at 8 hours.

## Related

- [Daily log](./daily-log.md) — focus sessions decide the day's study and deep-work minutes; English, reading, entertainment and your own minute activities are added onto the day; **Set up → New activity** creates the activities the timer offers
- [Learning](./learning.md) — learning runs become sessions, filed under a topic so **Time by topic** fills itself; the **Timer** card starts a run from there
- [Projects](./projects.md) — a project's time spent is the sum of project runs attributed to it
- [Health](./health.md) — an exercise run arrives as a workout
- [Calendar](./calendar.md) — **Plan vs actual** compares planned blocks with the focus sessions the timer records
- [Habits](./habits.md) and [Goals](./goals.md) — a habit or goal bound to study, deep work or a timed custom metric updates from the minutes a run files
- [Dashboard](./dashboard.md) — study and deep-work streaks read the minutes runs produce
- [Navigation](../get-started/navigation.md) — the header badge and the phone dock entry
- [Keyboard shortcuts](../get-started/keyboard-shortcuts.md) — `Space` on the timer page
- [Finance: transactions](./finance/transactions.md) — the other screen besides the daily log that works offline the same way
- [Data model: work and time](../reference/data-model/work-and-time.md) — `focus_sessions`, `timer_state` and `timer_filings`
