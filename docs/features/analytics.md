---
title: Analytics
description: Trends, comparisons and time allocation over 7 days, 30 days, 90 days or a year — shown only when there is enough data to mean anything.
sidebar_position: 17
---

# Analytics

Analytics shows how your days have gone over 7 days, 30 days, 90 days or a year: trends day by day, comparisons between groups of days, and where the hours went. It shows nothing until there is enough data to mean anything, and it never claims one thing caused another.

| | |
| --- | --- |
| **Where** | `/analytics` · sidebar → Insight · phone → **More** · `g` then `a` |
| **Works offline** | No |
| **Needs** | Nothing extra |

## Rules

- The stretch is 7 days, 30 days, 90 days or a year.
- A comparison needs at least 21 days with both values recorded, and at least 7 days in each group.
- A difference too small to separate from ordinary variation is withheld.
- Each card says which of these conditions it is still waiting for.
- Everything is stated as an association, never a cause.
- A blank day is *not recorded*, never zero, so it does not drag an average down.

## Read the trends

1. Open **Analytics** and choose the stretch: 7 days, 30 days, 90 days or a year.
2. **Trends** charts focus time, sleep, energy and entertainment day by day, with the stretch's total and average.
3. **Time allocation** shows where the hours went.

## Read a comparison

1. Find the **Comparisons** cards. Each splits the days into two groups and compares their averages:
   - sleep and energy
   - sleep and focus time
   - exercise and energy
   - entertainment and focus time
   - sleep and mood
2. If a card is waiting, it says what for — not enough days with both values, not enough in a group, or a difference too small to tell apart from ordinary variation.
3. Press **How this was calculated** on a card to see how many days qualified and how they split.

## How it works

**Nothing until it means something.** A comparison drawn from a handful of days is noise presented as a finding. The 21-day and 7-per-group thresholds, and withholding differences that ordinary variation could explain, keep the page from telling you something that is not there — and each card says which condition it is waiting for, so an empty card is an explanation rather than a mystery.

**Associations, not causes.** Two groups of days with different averages show that two things went together, not that one produced the other. Every card is worded as an association, and a test enforces that wording in both languages.

**Focus time is study plus deep work.** It is the day's study and deep-work minutes added together, as the daily log reads them — and focus sessions from the timer and Learning decide those minutes when they exist.

## Related

- [Daily log](./daily-log.md) — every number here comes from it; blank means not recorded
- [Timer](./timer.md) and [Learning](./learning.md) — focus sessions decide focus time
- [Health](./health.md) — workouts copy minutes into the day's exercise
- [Dashboard](./dashboard.md) — **Trends** over 7, 30 or 90 days, and the **Worth noticing** observations
- [Reviews](./reviews.md) — the same numbers summed for one period
- [Settings](./settings.md) — **Week starts on**, timezone and day rollover decide which day a value falls on
- [Keyboard shortcuts](../get-started/keyboard-shortcuts.md) — `g` then `a` jumps here
- [Data model: reviews and insights](../reference/data-model/reviews-and-insights.md) — rule-generated observations
- [Data model: daily log](../reference/data-model/daily-log.md) — `daily_logs` and `v_daily_effective`, the effective day the charts read
