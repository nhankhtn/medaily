---
title: Habits
description: Track things you mean to do regularly — tick them by hand, or bind them to a daily-log number so they tick themselves.
sidebar_position: 4
---

# Habits

A habit is something you mean to do on a schedule — every day, a few times a week, on chosen weekdays, or every few days. Tick it as you go, or bind it to a number on the daily log ("sleep ≥ 7h") and let it tick itself.

| | |
| --- | --- |
| **Where** | `/habits` · sidebar → Core → Habits · **Habits today** on the [dashboard](./dashboard.md) |
| **Works offline** | No |
| **Needs** | Nothing extra |

## Rules

- A habit runs every day (with a number of times per day), a number of times a week, on chosen weekdays, or every N days.
- You tick a habit for today only, on the Habits page or from the dashboard.
- A habit bound to a metric is never ticked by hand; it completes itself from the daily log.
- A tick that came from the daily log disappears if the number changes so the condition no longer holds. The habit and the log can never disagree.
- Binding a habit checks the days you had already logged and ticks the ones that qualify.
- With **Grace day for streaks** on, one missed day inside a week holds a streak instead of breaking it.
- Archiving a habit stops it appearing and keeps its history.
- Turning off the daily-log field a habit reads stops that habit counting.

## Create a habit

1. Open **Habits** and press **New habit**.
2. Name it.
3. Choose how often:
   - **every day**, with a number of times per day
   - **a number of times a week**
   - **on chosen weekdays**
   - **every N days**
4. Save.

## Tick a habit

1. Open **Habits**, or the **Habits today** card on the [dashboard](./dashboard.md).
2. Press the habit to tick it for today.

Each habit shows its last few days and its completion rate over 30 days. A weekly habit shows how far into the week's count you are.

## Let a habit tick itself

1. Open the habit's edit dialog, or start a new one.
2. Under **Tick it automatically**, pick a metric from the daily log — a built-in field or [one of your own](./daily-log.md#add-your-own-activity).
3. Choose the comparison and the threshold, for example sleep ≥ 7 hours or study ≥ 60 minutes.
4. Save. The habit checks the days you had already logged, and the toast says how many it ticked.

From then on, log the day on the [daily log](./daily-log.md) and the habit completes itself. Pressing it on the dashboard says it is bound and offers the daily log instead.

## Keep a streak through a missed day

1. Open [Settings](./settings.md).
2. Turn on **Grace day for streaks**.

One missed day inside a week now shows the streak as held rather than broken.

## Archive a habit

1. Open the habit's edit dialog.
2. Press **Archive**.

The habit stops appearing; its history is kept.

## How it works

**Entered once.** A habit bound to a metric reads the same number every other page reads — for study and deep work, that is the number resolved from your [timer](./timer.md) sessions. So "study ≥ 60 min" ticks itself from a timed session even if you typed nothing. Nothing asks twice.

**Derived ticks follow the number.** When the underlying number changes and the condition stops holding, the derived tick is removed — not set to "not done". "Not done" and "never ticked" must stay indistinguishable, or the completion rate would count them differently. Because the tick is derived, the habit and the daily log can never disagree.

**Binding looks back.** Binding a habit checks the days already logged, so you do not lose the history you built before binding it.

**A metric must be set completely.** The metric, the comparison and the threshold are set together or not at all.

**When a field is turned off.** Under [daily log **Set up**](./daily-log.md#choose-which-fields-the-form-asks), each built-in field says how many habits read it, because a habit stops counting when its field is off.

**What changed.** Adding, changing, archiving or deleting a habit is recorded in **What changed** in [Settings](./settings.md). Ticking one is not: a trail that records every tick buries the entries anyone actually goes looking for.

## Related

- [Daily log](./daily-log.md) — where a bound habit's number lives; your own activities can be bound too
- [Dashboard](./dashboard.md) — **Habits today**, logging and other streaks, and "a habit that needs every remaining day this week" in **Worth noticing**
- [Timer](./timer.md) — timed sessions supply the study and deep-work numbers a bound habit reads
- [Goals](./goals.md) — the longer-arc counterpart; a metric goal reads the same fields
- [Settings](./settings.md) — **Grace day for streaks**, **Week starts on**, and the **What changed** trail
- [Reviews](./reviews.md) — habit completion is one of each period's numbers
- [First days](../get-started/first-days.md) — "Create one habit" on the checklist
- [Keyboard shortcuts](../get-started/keyboard-shortcuts.md) — `g` then `h` jumps here
- [Data model: habits and goals](../reference/data-model/habits-and-goals.md) — `habits` and `habit_logs`
