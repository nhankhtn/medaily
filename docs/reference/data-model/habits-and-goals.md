---
title: Habits and goals
description: habits, habit_logs, goals and goal_milestones — schedules, metric-bound ticks, progress modes and weighted milestones.
sidebar_position: 4
---

# Habits and goals

Habits record what you repeat; goals record what you are working towards. Both can bind to a metric from the daily log — built-in or custom — so a fact entered once drives the tick or the progress bar. Shared columns are described in [Data model](./overview.md).

## `habits`

| Column | Type | Notes |
| --- | --- | --- |
| `name`, `category`, `icon`, `color` | text | `category` defaults to `'life'` |
| `frequency_type` | enum `habit_frequency` | `daily`, `weekly`, `specific_days`, `interval` |
| `target_count` | smallint | Times per period, at least 1 |
| `weekdays` | smallint[] | For `specific_days`; a `CHECK` requires at least one |
| `interval_days` | smallint | For `interval`; a `CHECK` requires it there, at least 1 |
| `linked_metric` | text | A metric key — built-in **or** a `custom_metrics.key` |
| `linked_operator` | enum | `gte`, `lte`, `eq` … |
| `linked_threshold` | numeric | "sleep ≥ 7" ticks itself from the log, so the same fact is never entered twice. Metric, operator and threshold are set together or not at all (`link_complete`) |
| `start_date`, `end_date` | date | `start_date` not null; `end_date ≥ start_date` |

## `habit_logs`

| Column | Type | Notes |
| --- | --- | --- |
| `log_date` | date | Unique with `habit_id` |
| `count`, `completed` | smallint, boolean | |
| `source` | enum `log_source` | `manual`, or `derived` when the tick came from the daily log |

A derived tick is **deleted** when the condition stops holding, not set to false — "not done" and "never ticked" must stay indistinguishable for completion-rate maths.

## `goals` / `goal_milestones`

| Column | Type | Notes |
| --- | --- | --- |
| `status` | enum `goal_status` | `active`, `completed`, `paused`, `cancelled` |
| `priority` | enum `priority` | `low`, `medium`, `high`; shared with projects and tasks |
| `start_date`, `target_date` | date | `target_date ≥ start_date` |
| `progress_mode` | enum | `manual`, `metric` or `milestones` |
| `progress_manual` | numeric | 0–100, for `manual` |
| `metric_key` | text | Built-in or custom |
| `metric_aggregation` | enum | `sum`, `avg`, `count_days`, `latest` |
| `metric_period` | enum | `total`, `weekly` or `monthly` — the window the target applies to |
| `metric_target` | numeric | `metric` mode requires key, aggregation, period and a target above zero, enforced by a `CHECK` |
| `metric_direction` | enum | `at_least` or `at_most` |
| `recurrence` | enum | `weekly`, `monthly`, `quarterly`, `yearly`; null for a one-off goal |
| `sort_order` | integer | Hand-arranged order within a status (`0014`), written by dragging a card |
| `completed_at` | timestamptz | |
| `goal_milestones.weight` | numeric | Progress is the completed share of total weight, so a heavier milestone moves the bar further. Above zero. The goal form has no weight input and writes `1`, so milestones made in the app count equally |

A project can serve a goal through `projects.goal_id`, which is `ON DELETE SET NULL` — deleting the goal keeps the project. See [Work and time](./work-and-time.md).

## Related

- [Data model](./overview.md) — conventions shared by every table
- [Habits](../../features/habits.md) — reads and writes `habits` and `habit_logs`
- [Goals](../../features/goals.md) — reads and writes `goals` and `goal_milestones`, including drag-to-reorder
- [Daily log](../../features/daily-log.md) — a logged day can tick a linked habit and move a metric goal
- [Projects](../../features/projects.md) — a project can serve a goal
- [Dashboard](../../features/dashboard.md) — streaks and goal progress on the front page
- [The daily log](./daily-log.md) — `custom_metrics.key` and `v_daily_effective`, which habits and goals read
- [Work and time](./work-and-time.md) — `projects.goal_id` and the shared `priority` enum
