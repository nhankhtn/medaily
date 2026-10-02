---
title: Health
description: Log workouts, body measurements and daily nutrition, and see the last 90 days at a glance.
sidebar_position: 8
---

# Health

Health keeps the detail the daily log does not need: the sets and reps of a workout, your weight and body measurements, and what you ate and drank today. The top of the page sums up the last 90 days — how many workouts, the total time, and the latest weight.

| | |
| --- | --- |
| **Where** | `/health` · sidebar → Life · phone → **More** |
| **Works offline** | No |
| **Needs** | Nothing extra |

## Rules

- The page covers the last 90 days.
- Saving a workout copies its minutes into that day's exercise on the daily log. Sets and reps stay on Health.
- A timed exercise run on the timer arrives here as a workout on its own — you do not log it twice.
- Weight is charted together with its 7-day average.
- Nutrition is one set of numbers per day: calories, protein, carbs, fat and water.

## Log a workout

1. Open **Health** and press **Log a workout**.
2. Fill the type, date, duration, distance, calories, effort (RPE) and a note — whatever you have.
3. Add one row per exercise with its sets, reps and weight.
4. Save. The workout's minutes are copied into that day's exercise on the [Daily log](./daily-log.md).

To time a workout instead, choose **Exercise** on the [Timer](./timer.md); the finished run becomes a workout here, with its type.

## Log a measurement

1. Press **Log measurement**.
2. Enter any of weight, body fat, waist and resting heart rate.
3. Save. Weight is drawn as a chart with its 7-day average.

## Log today's nutrition

1. Find the **Nutrition** card.
2. Enter today's calories, protein, carbs, fat and water.
3. Save. The last week is listed below for comparison.

## How it works

**The daily log only needs the minutes.** Exercise appears on the daily log as minutes, because that is all the day's numbers, streaks and comparisons use. Sets, reps and weights live here, where they are useful, and saving a workout copies the minutes across so the fact is entered once.

**A timed run is a workout.** When an exercise run on the timer finishes, it is filed here as a workout with the type you chose, and the minutes reach the daily log the same way.

**One measurement and one nutrition entry a day.** Measurements and nutrition are each kept as one row per day. Measurements are stored in metric; four nutrition numbers a day beats searching a food database.

## Related

- [Daily log](./daily-log.md) — a saved workout's minutes become that day's exercise
- [Timer](./timer.md) — an exercise run is filed here as a workout
- [Dashboard](./dashboard.md) — the exercise streak reads the day's exercise minutes
- [Analytics](./analytics.md) — compares exercise with energy
- [Reviews](./reviews.md) — counts exercise days for the period
- [Habits](./habits.md) and [Goals](./goals.md) — a habit or goal bound to exercise updates from the minutes a workout copies
- [Settings](./settings.md) — **Delete this account** removes the health log with everything else
- [Data model: health](../reference/data-model/health.md) — `workouts`, `workout_sets`, `body_measurements`, `nutrition_logs`
