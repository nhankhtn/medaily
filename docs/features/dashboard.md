---
title: Dashboard
description: Today at a glance — the day's numbers, a day and week score, streaks, observations worth noticing, trends, goals and today's habits.
sidebar_position: 1
---

# Dashboard

The dashboard is the home page: today at a glance. It shows the day's numbers against yesterday, how the week is going, your streaks, a few observations worth acting on, and the habits you can still tick today.

| | |
| --- | --- |
| **Where** | `/` · sidebar → Core → Home · phone dock → Home |
| **Works offline** | No |
| **Needs** | Nothing extra |

## Rules

- While today is still blank, the **Today** card offers a two-tap quick log (energy and sleep) instead of numbers.
- The score is an operational signal, not a measure of anyone's worth, and the card says so.
- **Snooze** hides an observation for a week; **Dismiss** hides it for good.
- Trends appear only once enough days have been logged.
- A habit bound to a metric cannot be ticked by hand; it ticks itself from the daily log.
- The Getting started checklist shows until every line is done or you hide it.

## Log today in two taps

1. Open the dashboard while today is still blank.
2. On the **Today** card, pick your energy and your sleep.

That saves today's daily log with those two fields. Open the [daily log](./daily-log.md) to fill the rest.

## Read the cards

| Card | What it shows |
| --- | --- |
| **Today** | The day's numbers against yesterday, with a link into the [daily log](./daily-log.md). While today is blank, the two-tap quick log takes its place |
| **Score** | A day score and a week score. Open it to see each part that made it and what it weighed |
| **This week** | The week's totals against last week's |
| **Streaks** | Logging, study, deep work, exercise and reading |
| **Worth noticing** | Observations the rules found — see below |
| **Trends** | The last 7, 30 or 90 days, once enough days exist |
| **Goals** | Your [goals](./goals.md) and how far along each is |
| **Habits today** | Today's [habits](./habits.md), which you can tick from here |

The [Getting started](../get-started/first-days.md#work-through-getting-started) checklist also sits on the dashboard until every line is done.

## See what made the score

1. On the **Score** card, open the score.
2. Read each part and what it weighed.

To change the weights, go to [Settings](./settings.md) → **Score weights**. They must add up to 100%, and there is a reset to the defaults.

## Act on an observation

**Worth noticing** lists things the rules found, such as:

- sleep short several nights running
- entertainment creeping up
- a goal off pace
- a habit that needs every remaining day this week
- a new best streak

For each one:

1. Press **Snooze** to hide it for a week, or
2. Press **Dismiss** to hide it for good.

## Tick a habit

1. On **Habits today**, press the habit.

A habit bound to a metric is not ticked by hand. Pressing it says so and offers the [daily log](./daily-log.md), where its number lives. Log the number there and the habit ticks itself.

## How it works

Everything on the dashboard is read from what you have already recorded; nothing on it is entered twice. Study and deep-work minutes come from the daily log resolved against your [timer](./timer.md) sessions, so the streaks, the score and the trends agree with the timer and with every other page.

**The score** is a weighted sum of parts, using the weights from Settings. Opening it shows every part and its weight, so a number is never a mystery. It is there to steer the day, not to grade you.

**Streaks** respect **Settings → Grace day for streaks**: with it on, one missed day inside a week holds a streak instead of breaking it.

**Worth noticing** is rule-based, not AI: each observation comes from a fixed check over your recent days, compared against thresholds. An observation is raised once — the same one is not raised twice for the same period — and a snooze or a dismiss is saved, so it survives a reload and holds on another device. The same observations feed the assistant's **Looking back**; see [Assistant](./assistant.md).

**Blank is not zero.** A day you did not log is *not recorded*, so it does not drag the week's totals, the trends or the score down.

## Related

- [Daily log](./daily-log.md) — the source of almost every number here; the quick log saves into it
- [Habits](./habits.md) — **Habits today**, and habits bound to a metric that tick themselves
- [Goals](./goals.md) — the **Goals** card, and "a goal off pace" in **Worth noticing**
- [Timer](./timer.md) — focus sessions decide study and deep-work minutes behind streaks and the score
- [Settings](./settings.md) — **Score weights** and **Grace day for streaks**
- [Analytics](./analytics.md) — the longer view behind **Trends**
- [Reviews](./reviews.md) — "Write a weekly review" on the checklist; the week in more depth
- [Assistant](./assistant.md) — **Looking back** reads the same observations as **Worth noticing**
- [First days](../get-started/first-days.md) — the Getting started checklist
- [Data model: reviews and insights](../reference/data-model/reviews-and-insights.md) — the `insights` table behind **Worth noticing**
- [Data model: core](../reference/data-model/core.md) — `user_settings` holds score weights, targets and observation thresholds
- [Data model: daily log](../reference/data-model/daily-log.md) — `v_daily_effective`, which the score and streaks read
