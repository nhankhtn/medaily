---
title: Work and time
description: Projects, tasks, focus sessions, the running timer, offline filings, planned blocks, calendar events and reminders.
sidebar_position: 5
---

# Work and time

These tables hold work you plan and time you spend: projects and their tasks, timed focus sessions, the one running timer and the claims that stop an offline run being filed twice, time blocks, calendar events and the reminders every module shares. Shared columns are described in [Data model](./overview.md).

## `projects` / `project_tasks`

| Column | Type | Notes |
| --- | --- | --- |
| `projects.status` | enum | `planned`, `active`, `on_hold`, `done`, `dropped` |
| `projects.goal_id` | uuid | A project can serve a goal. `ON DELETE SET NULL` — deleting the goal keeps the project |
| `project_tasks.project_id` | uuid, **nullable** | Null means a standalone task — "call mum" needs no project. `ON DELETE CASCADE`: deleting a project deletes its tasks |
| `project_tasks.parent_task_id` | uuid | One level only; deeper trees turn a personal tool into Jira. **No foreign key** in the database — the one-level rule and the parent's existence are the application's job |
| `project_tasks.status` | enum | `todo`, `doing`, `blocked`, `done` |
| `project_tasks.priority` | enum `priority` | `low`, `medium`, `high` |
| `project_tasks.due_date` | date | What the **Today** page filters on |
| `project_tasks.estimate_minutes` | smallint | 0–10080 (one week) |
| `project_tasks.completed_at` | timestamptz | Follows `status` |

## `focus_sessions`

Timed work. One shape records learning, deep work and project time, so one query path serves them all.

| Column | Type | Notes |
| --- | --- | --- |
| `session_date` | date | The rollover-aware logical day, which keeps the join to `v_daily_effective` free of timezone maths |
| `started_at`, `ended_at` | timestamptz | Nullable — a session typed by hand has no clock times. When both are set, `ended_at ≥ started_at` (`timestamps_ordered`) |
| `minutes` | smallint, not null | 1–1440 |
| `kind` | enum | `learning`, `deep_work`, `project` |
| `topic_id`, `project_id`, `task_id` | uuid | Attribution, each `ON DELETE SET NULL`. This is what makes a project's "time spent" derivable rather than typed |
| `source` | enum | `manual` or `timer` |

Sessions override the typed study and deep-work minutes in [`v_daily_effective`](./daily-log.md).

## `timer_state`

At most one running timer per user — `user_id` is the primary key.

| Column | Type | Notes |
| --- | --- | --- |
| `started_at` | timestamptz | Start of the current stretch, not of the whole run |
| `paused_at` | timestamptz | Non-null while paused |
| `accumulated_seconds` | integer | Time banked before the current stretch, so pausing does not lose it |
| `mode` | enum | `stopwatch` or `countdown` |
| `target_seconds` | integer | For `countdown`; 60–86400 |
| `activity` | text, not null | Default `'learning'` (`0010`). An activity id from `lib/timer/activities.ts` — `learning`, `deep_work`, `project`, `exercise`, `reading`, `english`, `entertainment`, or `custom:<metric id>` — and it decides where the finished run is filed: a focus session, a workout, a daily-log column, or a custom metric. Text, so a new activity is one entry in that file and no migration |
| `target` | enum `timer_target` | `focus` or `workout`. **Superseded by `activity`**; kept only so a migration can run ahead of the deploy without breaking the version still serving, and dropped in a later pass |
| `kind` | enum `focus_kind` | The focus kind, for a run that files as a session |
| `workout_type` | text | For `exercise` |
| `topic_id`, `project_id`, `task_id` | uuid | Attribution carried onto the session, each `ON DELETE SET NULL` |
| `note` | text | |

## `timer_filings`

One row per completed run that was filed — `id`, `user_id`, `created_at`, and nothing else (`0019`).

**The `id` is chosen by the client**, not generated: a run timed offline is queued on the device and may be sent more than once when the connection comes back. The filing claims its id here first with an insert that does nothing on conflict, so a retry finds the claim and files nothing, and daily minutes cannot be counted twice. If filing into the real table fails, the claim is deleted so the queue can try again.

## `planned_blocks`

Time blocking. **This is where forward-looking intent lives**, since daily logs are past-only, and it is what "plan vs actual" compares against.

| Column | Type | Notes |
| --- | --- | --- |
| `block_date`, `start_time`, `end_time` | | `end_time > start_time`, enforced by a `CHECK` |
| `kind` | enum | `learning`, `deep_work`, `project`, `exercise`, `other` |
| `project_id`, `task_id`, `topic_id` | uuid | What the block is for |

## `events`

Calendar entries, exported one-way as ICS.

| Column | Type | Notes |
| --- | --- | --- |
| `starts_at`, `ends_at` | timestamptz | |
| `all_day` | boolean | Changes how the ICS line is written |
| `recurrence_rule`, `recurrence_until` | enum, date | Expanded in `lib/planning/recurrence.ts`; a monthly event skips months without the day rather than sliding |

## `reminders`

One reminders table serves every module.

| Column | Type | Notes |
| --- | --- | --- |
| `due_on` | date, not null | |
| `recurrence` | enum `recurrence_rule` | `daily` … `yearly` |
| `person_id` | uuid | Set when it is about someone. `ON DELETE CASCADE` — a reminder about a deleted person goes with them |
| `entity_type`, `entity_id` | text, uuid | A loose pointer at anything else. Deliberately not a foreign key |
| `done_at`, `snoozed_until` | | |

## Related

- [Data model](./overview.md) — conventions shared by every table
- [Projects](../../features/projects.md) — reads and writes `projects` and `project_tasks`; time spent comes from `focus_sessions`
- [Timer](../../features/timer.md) — `timer_state` while running, `timer_filings` and `focus_sessions` when a run is filed
- [Calendar](../../features/calendar.md) — `planned_blocks`, `events`, the `.ics` export, due reminders, and the Day view's to-do list filtered on `due_date`
- [Goals](../../features/goals.md) — a project can serve a goal
- [Learning](../../features/learning.md) — sessions attributed to a topic
- [Health](../../features/health.md) — an `exercise` timer run files as a workout
- [People](../../features/people.md) — reminders about a person
- [The daily log](./daily-log.md) — `v_daily_effective` joins `focus_sessions` on `session_date`
- [Habits and goals](./habits-and-goals.md) — `goals`, which `projects.goal_id` points at
- [Learning and knowledge](./learning-and-knowledge.md) — `topics`
- [People](./people.md) — `people`, which `reminders.person_id` points at
- [Health](./health.md) — `workouts`
