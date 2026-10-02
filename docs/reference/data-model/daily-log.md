---
title: The daily log
description: daily_logs, custom metrics and the v_daily_effective view — one row per day, the spine every score, habit, goal and chart reads.
sidebar_position: 3
---

# The daily log

The daily log is one row per user per day and the spine of the app. Activities the user adds themselves extend it without a migration, and a view reconciles typed minutes with timed sessions so everything downstream reads one number. Shared columns are described in [Data model](./overview.md).

## `daily_logs`

One row per user per day. **Past-only**: it records what happened, never what is planned. Intent lives in `planned_blocks` and `project_tasks` (see [Work and time](./work-and-time.md)).

| Column | Type | Notes |
| --- | --- | --- |
| `log_date` | date, not null | Unique with `user_id`. The *logical* day, after rollover |
| `energy`, `mood` | smallint | 1–10 |
| `sleep_hours` | numeric(3,1) | |
| `bedtime`, `wake_time` | time | |
| `technical_study_minutes` | smallint | May be superseded by timed sessions — see [`v_daily_effective`](#v_daily_effective-view) |
| `deep_work_minutes` | smallint | Same |
| `exercise_minutes`, `exercise_type` | smallint, text | |
| `reading_minutes`, `reading_pages` | smallint | |
| `entertainment_minutes`, `english_minutes` | smallint | |
| `daily_win`, `daily_problem` | text | Seeded into the period review as suggestions |
| `tomorrow_priority` | text | Shown on the **Today** page the next day |
| `note` | text | |
| `source` | enum `log_source` | `manual`, `catch_up` or `import`. The enum is shared with `habit_logs`, which also uses `derived` |

Every metric column is nullable on purpose: **null is "not recorded", not zero**, and averages must not treat a blank day as a zero day. `CHECK`s hold each value in range (1–10, 0–24 hours, 0–1440 minutes), and `no_future_log` refuses a `log_date` later than `CURRENT_DATE + 1` — the extra day tolerates clock skew between the app server and the database, not planning ahead.

## `custom_metrics` / `custom_metric_values`

Activities the user added themselves, so the fixed columns above are not the ceiling.

`custom_metrics` — the definition:

| Column | Type | Notes |
| --- | --- | --- |
| `key` | text, not null | What a habit or a goal binds to. Unique with `user_id`. Lowercase slug, proposed from the English name but editable, and never one of the built-in metric names |
| `label_en`, `label_vi` | text, not null | Shown per locale |
| `type` | enum | `number`, `duration`, `boolean`, `scale`, `text` — decides which input the daily log renders. `duration` is minutes, and is the only kind the timer offers to run |
| `unit` | text | Display only. No conversion, no maths |
| `min`, `max` | numeric | Bounds for the stepper |
| `aggregation` | enum | How a goal totals it: `sum`, `avg`, `count_days`, `latest` |

`custom_metric_values` — one value per day per metric. Primary key is `(daily_log_id, custom_metric_id)`; there is no `id`.

| Column | Type | Notes |
| --- | --- | --- |
| `value_numeric` / `value_bool` / `value_text` | | Exactly one is non-null, enforced by a `CHECK`. Which one depends on the metric's `type` |

## `v_daily_effective` (view)

Not a table. Resolves `technical_study_minutes` and `deep_work_minutes` against timed `focus_sessions`, so a number typed by hand and a number counted by the timer can never disagree. Habits, goals, streaks, the score and analytics all read the view, not the raw columns. It is defined in `drizzle/views.sql`, re-applied on every migration run.

A day is in the view if it has a `daily_logs` row **or** a focus session — anchoring on the log alone made a timed session invisible until something was also typed into that day. On a session-only day `id` and every log column are null.

| Column | Notes |
| --- | --- |
| every `daily_logs` column | As stored |
| `effective_study_minutes` | Sum of `learning` sessions that day, else the typed `technical_study_minutes` |
| `effective_deep_work_minutes` | Sum of `deep_work` and `project` sessions, else the typed `deep_work_minutes` |
| `session_count` | All sessions that day; `0`, not null, when there are none |
| `learning_session_count`, `execution_session_count` | Per kind (`execution` is `deep_work` + `project`), so a hint can name the sessions it is actually describing |

Sessions win whenever any exist for that kind: the typed number is the fallback, never added on top. The join is on `focus_sessions.session_date`, which is already the rollover-aware logical day, so it needs no timezone maths.

## Related

- [Data model](./overview.md) — conventions shared by every table
- [Daily log](../../features/daily-log.md) — the form that writes `daily_logs` and `custom_metric_values`, and where custom activities are set up
- [Timer](../../features/timer.md) — timed runs become `focus_sessions` that override typed minutes, or fill a daily-log column or a `duration` custom metric
- [Habits](../../features/habits.md) — a habit bound to a metric ticks itself from this row
- [Goals](../../features/goals.md) — metric goals total a built-in or custom metric through the view
- [Calendar](../../features/calendar.md) — the Day view shows yesterday's `tomorrow_priority`
- [Dashboard](../../features/dashboard.md) — the day score and the day's numbers against yesterday
- [Reviews](../../features/reviews.md) — `daily_win` and `daily_problem` are seeded into the period review
- [Analytics](../../features/analytics.md) — reads `v_daily_effective`
- [Work and time](./work-and-time.md) — `focus_sessions`, and `planned_blocks` for forward-looking intent
- [Habits and goals](./habits-and-goals.md) — `habit_logs` shares the `log_source` enum
