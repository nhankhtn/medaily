---
title: AI service data access
description: Which of the app's tables medaily-ai reads, the exact columns and filters per repository, how every query is scoped to one person, and what it writes.
sidebar_position: 4
---

# AI service data access

The assistant in `medaily-ai` reads the app's own Postgres tables directly,
through a small set of read-only repositories. The service owns none of the
app's tables. The only thing it writes is the assistant's conversation
checkpoints, which live in a separate schema.

## Rules

- **Only the assistant reads.** The capture, review and report routes never
  touch the database. The app sends them everything they need.
- **The app's tables are read-only.** No repository contains an `insert`,
  `update` or `delete`. Everything the AI features save is written by the app.
- **Every query names one person.** Each repository takes a `userId` and starts
  its `where` clause with `user_id = …`. The id comes from the request. The app
  sets it from the signed-in session, never from the browser.
- **One list method per entity, with a filter.** A new question becomes a new
  filter field, not a new function.
- **Totals are computed in the database.** A month of rows is not worth
  shipping across an ocean just to average.
- **Only the columns a question needs are read.** No notes, journal entries or
  people are ever read.

## How it reaches the database

| | |
| --- | --- |
| **Database** | The app's Neon Postgres, through the same `DATABASE_URL` |
| **App tables** | postgres.js client (`src/infra/db.ts`), at most 5 connections, 20 s idle timeout |
| **Checkpoints** | LangGraph's `PostgresSaver` with its own `pg.Pool` (`src/infra/checkpointer.ts`), schema `agent` |
| **When `DATABASE_URL` is unset** | The client points at a dummy address, so the service still boots and `/health` reports `database: not_configured` |

Both clients import `src/lib/net.ts`, which raises Node's per-address connect
timeout from 250 ms to 2 s. The reason: Neon resolves to both IPv4 and IPv6
addresses. On a network without working IPv6, Node falls back to IPv4 but gives
each address only 250 ms, which is less than the round trip to `us-east-2`.
Every attempt timed out, and the connection reported `ETIMEDOUT` as if the
database were down.

> **Note:** The connection uses the app's own credentials. Read-only access is
> enforced by the code, not by a database role.

## Repositories

### Daily logs — `src/repositories/daily.ts`

Table: `daily_logs`.

**`listDailyLogs`** returns raw rows. The `daily` intent uses it, with a limit
of 14.

| Filter | SQL |
| --- | --- |
| `userId` (required) | `user_id = …` |
| `from`, `to` (optional) | `log_date >= …`, `log_date <= …` |
| `limit` | Default 60 |

Columns: `log_date`, `energy`, `mood`, `sleep_hours`,
`technical_study_minutes`, `deep_work_minutes`, `exercise_minutes`,
`reading_minutes`, `english_minutes`, `entertainment_minutes`, `daily_win`,
`daily_problem`, `tomorrow_priority`. Ordered by `log_date desc`. There is one
row per person per day, so the order is fixed.

**`aggregateDailyLogs`** returns one row per window. The `review` intent uses
it for the window and for the window before it.

| Output | SQL |
| --- | --- |
| `logged_days` | `count(*)` |
| `avg_energy`, `avg_mood`, `avg_sleep_hours` | `round(avg(…), 1)` |
| `total_*_minutes` | `sum(…)` of technical study, deep work, exercise, reading, English, entertainment |

Filter: `user_id = …` and `log_date between from and to`.

### Goals — `src/repositories/goals.ts`

Table: `goals`.

**`listGoals`** is used by `review` (active goals, limit 10) and `plan` (active
goals, limit 20).

| Filter | SQL |
| --- | --- |
| `userId` (required) | `user_id = …` |
| `status` | `active`, `completed`, `paused` or `cancelled` |
| `category` | Exact match |
| `includeArchived` | Off by default, which adds `archived_at is null` |
| `limit` | Default 40 |

Columns: `name`, `category`, `status`, `priority`, `start_date`,
`target_date`, `progress_mode`, `progress_manual`, `metric_key`,
`metric_target`. Ordered by `priority desc, target_date asc nulls last`: high
priority first, then the soonest deadline.

### To-dos — `src/repositories/tasks.ts`

Table: `project_tasks`.

**`listTasks`** is used by `plan` (open tasks, limit 30).

| Filter | SQL |
| --- | --- |
| `userId` (required) | `user_id = …` |
| `status` | `todo`, `doing`, `blocked` or `done` |
| `open` | Everything not `done` |
| `dueFrom`, `dueTo` | `due_date >= …`, `due_date <= …` |
| `limit` | Default 40 |

Columns: `title`, `status`, `priority`, `due_date`, `estimate_minutes`.
Ordered by `due_date asc nulls last, priority desc`.

### Money — `src/repositories/finance.ts`

Tables: `transactions`, left-joined to `finance_categories` for category names.

Both methods take the same filter:

| Filter | SQL |
| --- | --- |
| `userId` (required) | `t.user_id = …` |
| `from`, `to` (required) | `t.occurred_on between …` |
| `kind` | `income`, `expense` or `transfer`. When left out, transfers are excluded, because moving money is not spending it |
| `limit` | Default 20 per category, 62 per day |

**`spendByCategory`** returns, for each category and kind: `category` (the
category name, null when uncategorised), `kind`, `total` (`sum(t.amount)`) and
`entries` (`count(*)`). It groups by category name and kind, and orders by
total, largest first. It summarises rather than lists, because the question is
where the money went, and a line-by-line dump is larger and harder to answer
from.

**`spendByDay`** returns, for each calendar day and kind: `day`
(`occurred_on` as text), `kind`, `total` and `entries`. It is ordered by day.
Category totals alone cannot say which day was heavy, and questions like "chi
tiêu các ngày" need that.

The `finance` intent calls them six times, all in parallel: expense and income
by category, and expense by day, each for the window and for the window before
it.

### Users — `src/repositories/users.ts`

Table: `users`.

**`firstUserId`** returns the oldest user's `id`. It was meant for a
single-user setup where a request names no one. Nothing calls it, because
`userId` is required on every chat request.

## What it writes

| Where | What | When |
| --- | --- | --- |
| Schema `agent` (LangGraph `PostgresSaver` tables) | One checkpoint per node per run, keyed by `thread_id`: the whole agent state, including the conversation and the context that was loaded | Every node of every chat run |
| Schema `agent` | Removes all checkpoints of one thread | `DELETE /api/threads/:id` |
| Schema `agent` | Creates the tables themselves | `pnpm db:setup` |
| Schema `agent` | Threads named `bench-…` and `warmup-pg` | `pnpm bench`, which does not clean them up afterwards |

The `agent` schema is kept separate so the checkpointer's tables never collide
with a Drizzle migration. The app's migrations neither create nor touch it.

## Limits

- **The repositories read the raw daily logs, not the effective view.** They
  query `daily_logs`, not `v_daily_effective`. Study and deep-work minutes that
  the app replaces with timed focus sessions are read as typed. A day with only
  a focus session and no log row is not counted. This contradicts the service's
  own guide, which correctly tells you that sessions replace typed minutes.
- **The repositories read built-in metrics only.** They read no custom
  metrics, habits, focus sessions, workouts or budgets. `ROADMAP.md` puts
  habits, sessions and health first on the list of what to add.
- **Amounts are summed across currencies.** `spendByCategory` and `spendByDay`
  add up `amount` without converting it. A category or a day that holds more
  than one currency gets a mixed total.
- **Categories with the same name are merged.** `spendByCategory` groups by
  category name, so two of your categories that share a name report one total.
- **Some ties have no fixed order.** Goal, task and category ordering ends on a
  column that is not unique. Rows that tie (same priority and target date, same
  due date and priority, equal totals) can come back in any order, and the
  `limit` can cut a different row from run to run.
- **Archived projects are not checked.** `listTasks` does not look at whether a
  task's project is archived.

## Related

- [Overview](./overview.md) — what the service can read, at a glance
- [The agent](./agent.md) — which intent calls which repository
- [Configuration](./configuration.md) — `DATABASE_URL` and `pnpm db:setup`
- [Assistant](../../features/assistant.md) — the feature these queries answer
- [Dashboard](../../features/dashboard.md) — reads the same daily logs, goals and to-dos
- [Data model: daily log](../data-model/daily-log.md) — `daily_logs` and `v_daily_effective`
- [Data model: habits and goals](../data-model/habits-and-goals.md) — `goals`
- [Data model: work and time](../data-model/work-and-time.md) — `project_tasks`
- [Data model: finance](../data-model/finance.md) — `transactions`, `finance_categories`
- [Data model: core](../data-model/core.md) — `users`
- [Data model: reviews and insights](../data-model/reviews-and-insights.md) — `ai_reports`, written by the app, not the service
