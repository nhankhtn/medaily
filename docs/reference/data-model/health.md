---
title: Health
description: Workouts and their sets, body measurements and daily nutrition — stored metric, displayed in the user's unit system.
sidebar_position: 8
---

# Health

The health tables record workouts and their sets, one body measurement a day, and four nutrition numbers a day. Everything is stored in metric units. Shared columns are described in [Data model](./overview.md).

## Tables

| Table | Columns worth knowing |
| --- | --- |
| `workouts` | `performed_on`, `type`, `duration_minutes` (1–1440), `distance_km`, `calories`, `rpe` (rate of perceived exertion, 1–10) |
| `workout_sets` | `workout_id`, `exercise`, `sets`, `reps`, `weight_kg`, `rest_seconds` |
| `body_measurements` | `measured_on` (unique per user — one measurement a day), `weight_kg`, `body_fat_pct`, `waist_cm`, `resting_hr`, `blood_pressure`. Stored metric; the display follows `unit_system` |
| `nutrition_logs` | `log_date` (unique per user), `calories`, `protein_g`, `carbs_g`, `fat_g`, `water_ml`. Four numbers a day beats searching a food database |

`unit_system` is a column on `user_settings` (see [Core](./core.md)). A timer run with the `exercise` activity is filed as a workout, using `timer_state.workout_type` (see [Work and time](./work-and-time.md)).

## Related

- [Data model](./overview.md) — conventions shared by every table
- [Health](../../features/health.md) — reads and writes all four tables
- [Timer](../../features/timer.md) — an `exercise` run is filed as a workout
- [Daily log](../../features/daily-log.md) — `exercise_minutes` and `exercise_type` on the day's row
- [Settings](../../features/settings.md) — the unit system the display follows
- [Core](./core.md) — `user_settings.unit_system`
- [Work and time](./work-and-time.md) — `timer_state`
