---
title: Reviews and generated output
description: Weekly, monthly and yearly reviews with frozen snapshots, rule-generated insights, and stored AI reports.
sidebar_position: 11
---

# Reviews and generated output

These tables hold what the app writes about your data rather than the data itself: the period reviews you finalise, the observations the rules raise, and the reports the AI writes. Each one is stored so it reads later the way it read then. Shared columns are described in [Data model](./overview.md).

## `weekly_reviews` / `monthly_reviews` / `yearly_reviews`

The three share one shape, differing only in the period column (`week_start_date`, `month_start_date`, `year`), each unique per user.

| Column | Type | Notes |
| --- | --- | --- |
| `what_worked`, `what_didnt`, `change_next`, `top_priority`, `reflection` | text | |
| `metrics_snapshot` | jsonb | Frozen on finalise, so a review read a year later shows what it showed then |
| `snapshot_version` | integer | |
| `finalized_at` | timestamptz | Null means a draft, which recomputes from raw logs every time it is opened |

`daily_logs.daily_win` and `daily_problem` are seeded into the period review as suggestions (see [The daily log](./daily-log.md)).

## `insights` and `ai_reports`

| Table | Columns worth knowing |
| --- | --- |
| `insights` | `kind`, `severity` (`low`, `medium`, `high`, `win`), `payload` jsonb, `dedupe_key` (unique with `user_id`, so the same observation is not raised twice), `period_start`/`period_end`, `generated_at`, `dismissed_at`, `snoozed_until`. Persisted so a dismiss or snooze survives a reload. No `created_at`/`updated_at` |
| `ai_reports` | `kind` (`weekly`, `monthly`, `question`), `period_start`/`period_end`, `question`, `model`, `prompt_version`, `content_md`. The model and prompt version are stored so an old report can be read in context |

When an insight is worth showing is set by `user_settings.insight_thresholds` (see [Core](./core.md)).

## Related

- [Data model](./overview.md) — conventions shared by every table
- [Reviews](../../features/reviews.md) — writes and finalises the review tables
- [Analytics](../../features/analytics.md) — the charts the review snapshot summarises
- [Dashboard](../../features/dashboard.md) — where insights are shown, dismissed and snoozed
- [Quick capture and the assistant](../../features/assistant.md) — AI-written output
- [Settings](../../features/settings.md) — insight thresholds
- [The daily log](./daily-log.md) — the raw logs a draft recomputes from
- [Core](./core.md) — `user_settings.insight_thresholds`
