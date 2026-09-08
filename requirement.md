# Personal OS – Product Requirements & Technical Specification

**Version:** 2.0 — supersedes v1, which is kept in git history (`git show e32ed38:requirement.md`)
**Stack:** Next.js (App Router) + TypeScript + PostgreSQL + Drizzle ORM
**Architecture:** Modular Monolith
**UI:** Responsive Web App, bilingual (English / Vietnamese)
**Scope:** Complete personal management system — **not** an MVP-only scope
**Auth:** Deferred (single-user local deployment; ownership modeled explicitly)

---

## 0. Decision Log (v1 → v2)

Every open question in v1 is resolved here. This section is the quick reference; the rest of the document is the authority.

### 0.1 Decisions given by the product owner

| # | Question | Decision |
|---|---|---|
| 1 | Authentication | **Not required now.** Single-user, no login screen. Ownership still modeled via `users` / `user_id` so auth can be added later without a data migration. See §29. |
| 2 | ORM | **Drizzle ORM** + `drizzle-kit` migrations + `postgres.js` driver. |
| 3 | Language | **EN / VI switchable at runtime** from anywhere in the app. See §21. |
| 4 | Scope | **Complete product**, not MVP. All v1 "future modules" (finance, knowledge, calendar, CRM, health, career, AI) are in scope. Phases in §35 are build *order*, not scope cuts. |
| 5 | Business rules | **Decided in this document.** Conventions borrowed from established apps, tuned for convenience. |

### 0.2 Contradictions in v1, now resolved

| v1 conflict | Resolution |
|---|---|
| §5.3 lists "Weekly score" but §16 calls the score *optional* | Score is **in scope and always on**, with a fully transparent, user-editable formula. See §19. |
| `study_sessions` vs `daily_logs.technical_study` — which is source of truth? | Both exist, with a deterministic precedence rule: **sessions win when they exist**, manual number otherwise. Resolved by view `v_daily_effective`. See §5.4 + §27.3. |
| `weekly_reviews` stores aggregates, but §22 wants summaries derived from raw data | While a review is a **draft**, numbers are computed live from raw logs. On **finalize**, a `metrics_snapshot` is frozen so a review read a year later shows what it showed then. See §17. |
| `daily_metrics` listed but "don't build until needed" | Built, as `custom_metrics` + `custom_metric_values` (full-product scope). Core metrics stay normalized columns. See §27.2. |
| "Do not over-engineer" vs full module list | Still no Redis/Kafka/ES/ClickHouse/microservices. Breadth comes from *modules*, not infrastructure. See §38. |

### 0.3 Business logic decided here

| Topic | Decision | Reference |
|---|---|---|
| Study vs deep work | Disjoint by definition; never double-counted | §5.2 |
| Reading | `reading_minutes` is canonical for totals/score; `reading_pages` is optional colour | §5.2 |
| Exercise | Minutes + free-text type with suggestion chips; detailed sets/reps live in Health | §5.2 |
| Day boundary | User timezone + **day rollover hour** (default 04:00) so a 1 a.m. entry belongs to the previous day | §20.1 |
| Week start | Monday (ISO-8601), configurable to Sunday | §20.2 |
| Streaks | Break only after **two** consecutive misses; one miss per rolling 7 days is auto-frozen | §20.3 |
| Missing days | Never scored as zero; surfaced as coverage, plus a catch-up flow | §19.4, §22.6 |
| Habits ↔ daily log | A habit may bind to a metric and complete itself automatically — no double entry | §7.3 |
| Goal progress | Three modes: `manual`, `metric` (auto), `milestones` (auto) | §8.2 |
| Correlations | Bucket comparison first, Pearson second, hard minimum-sample gates, non-causal wording enforced by tests | §18.3 |
| Warnings | Fixed rule set with thresholds in settings; dismissible and snoozable | §18.4 |
| Future-dated logs | Not allowed for daily logs; planning belongs to Calendar / planned blocks | §5.3 |
| Saving | Explicit Save + local draft autosave + undo toast | §6.3 |
| Score caching | None. Computed on read; revisit only after benchmarking | §19.5 |
| Money | `numeric(14,2)`, multi-currency, default VND | §12 |
| Deployment | Docker Compose (app + Postgres) as the primary target; Vercel + managed Postgres supported | §34 |

---

## 1. Product Vision

A personal operating system for tracking daily performance, understanding one's own behaviour, managing goals and projects, and progressively absorbing the rest of personal life management — health, money, knowledge, relationships, career.

Two rules outrank every feature:

> **Data first, dashboard second.**
>
> **Logging must be faster than opening a spreadsheet.**

If a feature makes daily logging slower, the feature is wrong.

## 2. Product Goals

- Record a full day in **under 60 seconds** on mobile (v1 target was 2 minutes; the full product should beat it).
- Track career/learning, health, lifestyle, finance, knowledge, relationships over years.
- Show **trends and comparisons**, not just rows.
- Surface repeated bad patterns early, and possible correlations — always as correlation.
- Support measurable goals with automatic progress.
- Provide weekly, monthly, and yearly reviews.
- Work equally well on phone and desktop, installable as a PWA.
- Stay modular so a new life domain can be added without touching the others.
- Keep every byte exportable and every deployment reproducible.

## 3. Non-Goals

- No social features, sharing, or feeds.
- No general-purpose Jira replacement — projects serve *personal* work.
- No brokerage integration or trade execution; investments are tracked, not traded.
- No AI features that pretend to know things the data cannot support.
- No multi-tenant SaaS operation. Ownership is modeled, but the product is single-user.
- No mandatory cloud dependency: it must run fully offline on a laptop with Docker.

---

## 4. Modules

**Core loop (highest priority):** Dashboard · Daily Log · Habits · Goals · Reviews · Analytics

**Domains:** Projects · Learning & Focus · Knowledge Base · Journal · Health · Finance · Calendar & Planning · People (CRM) · Career

**System:** Search · Notifications & Reminders · Import/Export & Backup · AI Analyst · Settings

Every module follows the same contract (§26.2): its own `features/<module>` slice, its own tables, no cross-module imports except through published module APIs.

---

## 5. Daily Log — Data Definitions

The daily log is the heart of the system. One row per user per local date.

### 5.1 Fields

| Field | Column | Type | Range / Unit | Priority |
|---|---|---|---|---|
| Date | `log_date` | date | user-local date | Required |
| Energy | `energy` | smallint | 1–10 | Required |
| Sleep duration | `sleep_hours` | numeric(3,1) | 0–24 h | Required |
| Technical study | `technical_study_minutes` | smallint | 0–1440 | Required |
| Deep work | `deep_work_minutes` | smallint | 0–1440 | Recommended |
| Exercise | `exercise_minutes` | smallint | 0–1440 | Recommended |
| Exercise type | `exercise_type` | text | free text + chips | Optional |
| Reading | `reading_minutes` | smallint | 0–1440 | Recommended |
| Reading pages | `reading_pages` | smallint | 0–10000 | Optional |
| Entertainment | `entertainment_minutes` | smallint | 0–1440 | Recommended |
| English practice | `english_minutes` | smallint | 0–1440 | Optional |
| Mood | `mood` | smallint | 1–10 | Optional |
| Bedtime | `bedtime` | time | local | Optional |
| Wake time | `wake_time` | time | local | Optional |
| Daily win | `daily_win` | text | ≤ 500 chars | Optional |
| Daily problem | `daily_problem` | text | ≤ 500 chars | Optional |
| Tomorrow priority | `tomorrow_priority` | text | ≤ 500 chars | Optional |
| Note | `note` | text | free form | Optional |

Plus any number of user-defined metrics (§27.2).

### 5.2 Metric semantics (these definitions are binding)

These were ambiguous in v1 and caused double-counting risk.

**Technical study** — time spent *acquiring* skill or knowledge: courses, documentation, technical books, deliberate practice, exercises, reading source code to learn it.

**Deep work** — time spent in *uninterrupted focused execution*: shipping code, writing, designing, building. Domain-independent.

> **They are disjoint.** A block of time is classified by its primary intent and counted once. The form shows this hint, and a soft validation warns when `sleep + study + deep_work + exercise + reading + entertainment > 20h` — a warning, never a blocker.

**Exercise** — `exercise_minutes` is the single truth for "did I exercise" (`did_exercise := exercise_minutes > 0`). `exercise_type` is free text with suggestion chips built from the user's own history (most-used first). Sets, reps, distance, and heart rate belong to the Health module's `workouts` table; a workout logged there back-fills `exercise_minutes` for that date if the daily field is still empty.

**Reading** — `reading_minutes` is canonical for all totals, streaks, and scoring. `reading_pages` is a second, optional dimension shown in analytics but never summed into time.

**Entertainment** — recreational screen time the user wants to *limit*: gaming, YouTube, streaming, scrolling. Scored inversely (§19.2).

**English practice** — counted separately and *not* included in technical study, so language work is visible on its own.

**Sleep** — `sleep_hours` is the required number. `bedtime`/`wake_time` are optional; when both are given and `sleep_hours` is empty, the app computes it (handling the midnight crossing) and lets the user override.

### 5.3 Rules

- `UNIQUE(user_id, log_date)` — one log per day, enforced by the database.
- **No future dates.** The date picker stops at today (in the user's timezone, after rollover). Planning lives in Calendar and `planned_blocks`; `tomorrow_priority` is the one forward-looking field, by design.
- **Unlimited back-editing.** Any past day is editable forever; `updated_at` tracks it. There is no lock window — the point of the system is honesty, not audit.
- Every numeric field is nullable and distinguishes **"not logged" (NULL)** from **"logged as zero"**. Analytics must never average a NULL as 0.
- `source` records how the row arrived: `manual | catch_up | import | derived`.

### 5.4 Derived values (session precedence)

When a day has `focus_sessions` (§10), those are more accurate than a hand-typed number. The rule:

```text
effective_study_minutes    = COALESCE(SUM(sessions WHERE kind='learning'),  technical_study_minutes)
effective_deep_work_minutes= COALESCE(SUM(sessions WHERE kind IN ('deep_work','project')), deep_work_minutes)
```

Exposed as SQL view `v_daily_effective` (§27.3). **All analytics, scores, streaks, and reviews read the view, never the raw column.** In the UI, when sessions exist the manual field becomes read-only and displays `“90m from 3 sessions”` with a link to the sessions and an "override manually" escape hatch.

---

## 6. Fast Daily Entry — UX Specification

This screen gets more design attention than any other.

### 6.1 Structure

- **Route:** `/daily` (today) and `/daily/[date]` (any day).
- Three progressive sections:
  1. **Essentials** — always expanded: Energy, Sleep, Technical study, Deep work.
  2. **Activity** — expanded by default on desktop, collapsed on mobile: Exercise, Reading, Entertainment, English, Mood.
  3. **Reflection** — collapsed: win, problem, tomorrow priority, note, custom metrics.
- Section headers show a filled/total count so the user knows what is left.

### 6.2 Input mechanics

| Metric | Control |
|---|---|
| Energy, Mood | 10-segment tap bar (not a drag slider — one tap, no precision required); keys `1`–`0` set it |
| Sleep | Stepper in 0.5 h increments, wide tap targets, long-press to repeat |
| Minute fields | Numeric keypad input + preset chips (`15 / 30 / 45 / 60 / 90 / 120`) + `+15` bump button |
| Exercise | Single toggle reveals minutes + type chips |
| Text fields | Auto-growing textarea, no character counters until 80% of the limit |

### 6.3 Saving

- **Explicit Save**, always visible in a sticky footer (mobile) or sticky panel (desktop).
- **Draft autosave** to `localStorage`, keyed by date, written debounced at 500 ms. Draft is restored on return and cleared on successful save. Survives refresh, crash, and tab loss.
- Navigating away with unsaved edits prompts.
- After save: optimistic UI, success toast with **Undo** (5 s, restores the previous row from a snapshot), and the dashboard revalidates immediately.
- Autosave-to-server was rejected: it spams writes on every slider tick and makes "undo" meaningless.

### 6.4 Convenience features

- **Copy yesterday** — one tap fills every field from the previous logged day; each copied field is highlighted until touched.
- **Smart defaults** — an empty field shows the user's 14-day median as ghost placeholder text; tapping the ghost accepts it.
- **Catch-up mode** — when 2+ recent days are unlogged, the daily page offers "3 days missing → fill in" and presents a compact one-row-per-day grid so the backlog clears in one screen. Rows saved here get `source='catch_up'`.
- **Date navigation** — arrows, a date picker, swipe left/right on mobile, `[` / `]` on desktop; "Today" always one tap away.
- **Streak-safe hint** — if today is unlogged and it is past the reminder time, the dashboard shows a single-line inline quick-log (energy + sleep only) that creates the row in two taps and can be completed later.
- **Timer hand-off** — a running focus timer (§10.3) contributes to today's study/deep work automatically; the daily form reflects it live.

### 6.5 Empty and first-run states

- First run offers **demo data** (90 days, §32) that can be wiped in one click from Settings — the dashboard is never demonstrated empty.
- Every module empty state explains the value in one sentence and gives one primary action.

---

## 7. Habits

### 7.1 Definition

`name`, `category`, `icon`, `colour`, `frequency`, `target_count`, active period (`start_date`, `end_date`), `notes`, `sort_order`, `archived_at`.

Archiving, never deleting, is the default action — history stays intact. Hard delete exists in Settings with an explicit confirmation.

### 7.2 Frequency model

| Type | Meaning | Scheduled on | Streak unit |
|---|---|---|---|
| `daily` | every day, `target_count` times per day (default 1) | every day | days |
| `weekly` | `target_count` times per week, any days | the whole week | weeks |
| `specific_days` | on chosen weekdays (`weekdays smallint[]`, ISO 1–7) | those weekdays | days (only scheduled days count) |
| `interval` | every `interval_days` days from `start_date` | matching dates | days |

Completion of a period = `count >= target_count`. Completion rate = `completed periods / scheduled periods` within the range — **unscheduled days never count against the user**, which was undefined in v1.

### 7.3 Metric-linked habits (removes double entry)

A habit may declare a binding to a daily metric:

```text
linked_metric    ∈ { sleep_hours, technical_study_minutes, deep_work_minutes,
                     exercise_minutes, reading_minutes, entertainment_minutes,
                     english_minutes, energy, mood, custom:<key> }
linked_operator  ∈ { gte, lte, eq }
linked_threshold numeric
```

Example: *"Sleep 7h+"* → `sleep_hours gte 7`; *"Entertainment under 1h"* → `entertainment_minutes lte 60`.

Rules:
- Saving a daily log recomputes linked habit completions for that date in the **same transaction** (`habit_logs.source = 'derived'`).
- Derived completions are read-only in the habit UI and show "from daily log" with a link.
- Unlinked habits are ticked manually (`source = 'manual'`).
- Changing a habit's binding recomputes its history from `start_date` in a background-safe batch, and says so.

### 7.4 Habit UI

- **Today view:** one tap per habit; long-press for count/notes; drag to reorder.
- **Grid view:** habits × last 28 days, cells tappable to backfill.
- **Heatmap:** 12 months per habit, GitHub-style, click a cell to edit that day.
- Per habit: current streak, best streak, 30-day completion rate, "scheduled N/week".

---

## 8. Goals

### 8.1 Definition

`name`, `description`, `category` (`career | health | finance | knowledge | life`, user-extensible), `status` (`active | completed | paused | cancelled`), `priority` (`low | medium | high`), `start_date`, `target_date`, `progress_mode`, `notes`, optional link to a `project`, milestones.

### 8.2 Progress modes

| Mode | Progress computed from |
|---|---|
| `manual` | A number the user sets (0–100), with an updated-at timestamp |
| `metric` | `metric_key` + `aggregation` (`sum / avg / count_days / latest`) + `period` (`total / weekly / monthly`) + `target_value` + `direction` (`at_least / at_most`) |
| `milestones` | `Σ weight(completed) / Σ weight(all)`; equal weights unless set |

`metric` examples — *"300 study minutes per week"* → `technical_study_minutes, sum, weekly, 300, at_least`; *"Entertainment under 10h/week"* → `entertainment_minutes, sum, weekly, 600, at_most`.

`at_most` progress = `clamp(0, 1, 2 − actual/target)` — full credit at or below target, zero at double it. Progress is always **computed on read** from `v_daily_effective`; never stored, never stale.

### 8.3 Goal UX

- Progress bar with the actual numbers underneath (`214 / 300 min this week`), never a bare percentage.
- **Pace indicator:** for time-bounded goals, compares elapsed time against progress and reports `ahead / on track / behind` plus the required rate to finish on time.
- Goals nearing `target_date` with low progress raise an insight (§18.4).
- Completing the last milestone offers to mark the goal complete.
- Recurring goals: `recurrence` (`weekly | monthly | quarterly | yearly`) auto-creates the next period's instance on completion or expiry, carrying settings forward.

---

## 9. Projects & Tasks

- **Projects:** `name`, `description`, `status` (`planned | active | on_hold | done | dropped`), `priority`, `start_date`, `end_date`, optional `goal_id`, `notes`, `archived_at`.
- **Tasks:** `title`, `status` (`todo | doing | blocked | done`), `priority`, `due_date`, `estimate_minutes`, `parent_task_id` (one level of sub-tasks), `sort_order`, `completed_at`.
- **Time spent** is never typed by hand: it is `SUM(focus_sessions.minutes)` for the project, with a manual adjustment entry available. This resolves v1's ambiguity about `time spent`.
- Views: board (by status), list (sortable, filterable), and a project detail page with tasks, milestones, time, and notes.
- Task interactions: inline add (Enter to add another), keyboard reordering, bulk complete, quick-add from the command palette (`/task ...`).
- A task can start a focus timer directly, which attributes its minutes to the project.

---

## 10. Learning & Focus

### 10.1 Focus sessions

v1's `study_sessions` is renamed **`focus_sessions`** because the same table also records deep work and project time — one shape, one query path.

`started_at`, `ended_at`, `minutes`, `kind` (`learning | deep_work | project`), optional `topic_id`, `resource_id`, `project_id`, `task_id`, `note`, `source` (`timer | manual`).

`minutes` is stored (not derived from timestamps) so a manual entry needs no fake times; when both timestamps exist, a `CHECK` keeps them consistent.

### 10.2 Topics and resources

- **Topics:** a shallow tree (`parent_id`, max depth 2) — e.g. `Databases → MVCC`. Study time by topic answers "where did my learning hours go".
- **Resources:** books, courses, articles, videos — `type`, `title`, `author`, `url`, `status` (`backlog | in_progress | done | dropped`), `progress_percent`, `rating`, `started_at`, `finished_at`, `notes`. Sessions and notes can attach to a resource, giving a per-book/per-course time total.

### 10.3 Timer

- Global start/stop control in the header, persisted server-side so it survives refresh and follows the user across devices.
- Optional Pomodoro (25/5, configurable) with a browser notification.
- On stop: kind, topic, project, and note are pre-filled from the last session and editable in one dialog.
- A crashed/forgotten timer running > 8 h is capped and flagged for correction rather than silently recording 14 hours.

---

## 11. Health

- **Workouts:** `performed_at`, `type`, `duration_minutes`, `distance_km`, `calories`, `rpe` (1–10), `note`; child `workout_sets` (`exercise`, `sets`, `reps`, `weight_kg`, `rest_seconds`). Back-fills `daily_logs.exercise_minutes` (§5.2).
- **Body measurements:** one row per date — `weight_kg`, `body_fat_pct`, `waist_cm`, `resting_hr`, `blood_pressure`, `note`. Trend charts use a 7-day moving average so daily noise does not read as progress or failure.
- **Nutrition (lightweight):** per-day totals — `calories`, `protein_g`, `carbs_g`, `fat_g`, `water_ml`, optional per-meal rows. Deliberately not a food database; typing four numbers is faster than searching for a banana.
- Units follow the settings `unit_system` (`metric | imperial`); storage is always metric.

---

## 12. Finance

Envelope-free, plain double-entry-lite bookkeeping — enough to know net worth and where money goes, without becoming accounting software.

- **Accounts:** `name`, `type` (`cash | bank | credit_card | e_wallet | investment | loan`), `currency`, `opening_balance`, `archived_at`. Balance = opening + transactions.
- **Categories:** tree (one level of children), `kind` (`income | expense`), icon, colour.
- **Transactions:** `occurred_on`, `amount numeric(14,2)`, `currency`, `kind` (`income | expense | transfer`), `account_id`, `counter_account_id` (transfers), `category_id`, `merchant`, `note`, `tags`. A transfer is one row touching two accounts, so it never inflates income or expense.
- **Recurring transactions:** template + `recurrence_rule` + `next_due_on`; materialized on due date (or on next app open) into real transactions the user can edit — never silently guessed.
- **Budgets:** per category per month, `amount`, with rollover flag. Progress bars show spent / budget / remaining and days left in the month.
- **Assets & liabilities:** `name`, `kind`, `value`, `as_of` snapshots → net-worth trend over time.
- **Investments:** `symbol`, `quantity`, `avg_cost`, `currency`, optional manual `last_price` + `priced_at`. No market data feed, no trading (§3). Returns are shown as unrealized P/L with the pricing date stated.
- **Money rules:** exact `numeric`, never floats. Amounts stored positive with `kind` deciding direction. Default currency VND, formatted per locale (`1.234.567 ₫` in vi, `₫1,234,567` in en). Multi-currency: each account has one currency; cross-currency transfers store an explicit `fx_rate`.
- **Convenience:** quick-add from the command palette (`/expense 45k coffee`), a last-10-transactions repeat list, CSV import with a column mapper (§33), and a monthly "cash flow" view (income − expense − transfers).

---

## 13. Journal, Notes & Knowledge Base

### 13.1 Journal vs daily note (v1 ambiguity resolved)

- `daily_logs.note` — a **single quick line** inside the day's log. One per day. Meant for a passing thought.
- `journal_entries` — **long-form**, many per day: `entry_date`, `title`, `body_md`, `mood`, tags, `created_at`. Meant for real reflection, with a full Markdown editor.

The daily form shows a "write more →" link that opens a journal entry pre-dated to that day.

### 13.2 Knowledge base

- **Notes:** `title`, `body_md`, `type` (`note | concept | bookmark`), `url` (bookmarks), tags, `topic_id`, `resource_id`, backlinks via `[[title]]` wiki-links resolved to `note_links`.
- **Tags:** flat, user-owned, autocompleted everywhere, renameable (rename propagates).
- Markdown editor with live preview, code blocks with highlighting, image paste → attachment (§27.10), and slash commands.
- **Search (§22.4)** covers notes, journal, daily-log text fields, tasks, and people in one query.

---

## 14. Calendar & Planning

- **Events:** `title`, `starts_at`, `ends_at`, `all_day`, `category`, `location`, `note`, `recurrence_rule` (RFC 5545 subset: daily/weekly/monthly, interval, until, byweekday).
- **Planned blocks (time blocking):** `block_date`, `start_time`, `end_time`, `kind` (`learning | deep_work | project | exercise | other`), optional `project_id` / `task_id` / `topic_id`, `note`.
- **Plan vs actual** — the single most useful view here: planned blocks overlaid with the day's `focus_sessions`, showing where the plan held and where it did not. This is where future-dated *intent* lives, since daily logs are past-only (§5.3).
- Views: month grid, week columns, day agenda; mobile defaults to agenda.
- One-way ICS export (`/api/calendar.ics`) so the data can be read in any calendar app. No external calendar sync in scope.

---

## 15. People (Personal CRM)

- **People:** `name`, `relationship` (`family | friend | colleague | mentor | other`), `company`, `role`, `birthday`, `phone`, `email`, `socials`, `notes`, `contact_interval_days` (desired cadence), `last_interaction_at` (derived).
- **Interactions:** `person_id`, `occurred_at`, `channel` (`in_person | call | message | email | other`), `summary`.
- **Reminders:** shared table used across modules — `title`, `due_at`, `recurrence`, `person_id?`, `entity_type/entity_id?`, `done_at`, `snoozed_until`.
- **Stay-in-touch surfacing:** anyone past their `contact_interval_days` appears in a "reach out" list, and upcoming birthdays appear on the dashboard 7 days ahead. This is the whole point of a personal CRM; without it the data is dead weight.

---

## 16. Career

- **Skills:** `name`, `category`, `level` (1–5), `target_level`, `last_practiced_at` (derived from focus sessions on linked topics), `notes`. A radar/bar view shows current vs target.
- **Achievements:** `title`, `achieved_on`, `description`, `impact`, `link` — the raw material for a CV or performance review, captured when it happens instead of remembered later.
- **Portfolio items:** `title`, `url`, `description`, `tech`, `project_id?`.
- Career goals are ordinary goals with `category = career`; no separate table.

---

## 17. Reviews

### 17.1 Cadence

Weekly, monthly, and yearly. Same shape, different period.

| Table | Key |
|---|---|
| `weekly_reviews` | `UNIQUE(user_id, week_start_date)` |
| `monthly_reviews` | `UNIQUE(user_id, month_start_date)` |
| `yearly_reviews` | `UNIQUE(user_id, year)` |

### 17.2 Content

**Computed section** (read-only, from raw data): average energy and mood, average sleep, total study / deep work, exercise days and minutes, reading total, entertainment total, habit completion rate, goals advanced, best and worst day by score, and the delta against the previous period for every one of them.

**Written section:** what worked · what did not work · what to change · top priority for next period · free-form reflection.

### 17.3 Draft vs finalized (v1 conflict resolved)

- While `finalized_at IS NULL`, the computed numbers are **recalculated live** from `v_daily_effective` — the review is a lens on raw data (§22 acceptance criterion).
- On **Finalize**, the computed block is frozen into `metrics_snapshot jsonb` together with `snapshot_version`. Re-opening an old review shows the frozen numbers with the date they were computed, and a "recompute" action for when historical data was edited afterwards.

### 17.4 Convenience

- The review page opens with the written fields pre-seeded from the period's `daily_win` / `daily_problem` entries, quoted as a bullet list — the user edits rather than starting from a blank page.
- Reviews are proposed, not nagged: a dashboard card appears on the first day of a new period and disappears when finalized or dismissed.
- Weekly review carries `top_priority` forward: next week's review shows last week's priority alongside "did it happen?".

---

## 18. Analytics & Insights

### 18.1 Trend views

- Ranges: 7 / 30 / 90 / 365 days and "all", plus a custom range picker.
- Every metric: line or bar with a 7-day moving average, period average line, and the delta vs the previous equal-length period.
- Study time by topic and by category (stacked area + table).
- Time allocation: how the tracked hours of a period split across learning, deep work, exercise, reading, entertainment.
- Habit completion rate over time; goal completion rate per category.
- Calendar heatmap per metric (year view), clicking a cell opens that day.

### 18.2 Comparisons

Sleep vs energy · sleep vs study minutes · exercise vs energy · entertainment vs study · mood vs everything. Each is presented as a bucket comparison (§18.3) plus a scatter with a lightly drawn fit line.

### 18.3 Correlation rules (binding)

**Method.** Bucket comparison is primary because it is what the v1 spec's "good" example states. Buckets are the metric's own terciles, or a natural threshold where one exists (sleep ≥ 7h, entertainment ≤ 60m).

**Gates — no insight is shown unless all pass:**
- ≥ 21 days in range with **both** metrics non-NULL.
- Each bucket has ≥ 7 days.
- The difference between buckets is ≥ 5% of the outcome metric's range (filters out noise dressed as findings).

Pearson `r` is shown as a secondary number with `n` and a plain-language strength label, never alone.

**Wording.** Insight templates state association and nothing more:

> ✅ *"Average energy was 7.8 on days with at least 7 hours of sleep, versus 6.1 on days below that (n = 42)."*
>
> ❌ *"Sleeping 7 hours causes higher energy."*

Causal verbs (`cause`, `because of`, `leads to`, `makes`, `improves`, `gây ra`, `dẫn đến`, `làm cho`, `nhờ`) are **forbidden in insight and correlation i18n strings**, and a unit test asserts their absence from those namespaces in both locales (§31.1).

Every insight card carries `n`, the date range, and a "how this was calculated" disclosure.

### 18.4 Warning rules (the "what is hurting me" engine)

Deterministic rules, evaluated for the current date, each with a threshold in settings:

| Rule | Default condition | Severity |
|---|---|---|
| Sleep deficit streak | `sleep_hours < 6` for 3 consecutive days | high |
| Sleep debt | 7-day avg `sleep_hours < 6.5` | medium |
| Entertainment creep | `entertainment_minutes > 120` on ≥ 4 of last 7 days | medium |
| Exercise gap | no exercise in the last 5 days | medium |
| Study slump | 7-day study total ≤ 60% of the prior 7 days (and prior ≥ 120 min) | medium |
| Energy decline | 7-day avg energy ≥ 1.5 points below the prior 7 days | medium |
| Logging gap | ≥ 2 consecutive unlogged days | low |
| Habit at risk | a habit's weekly target is mathematically still reachable but needs every remaining day | low |
| Goal off pace | `target_date` within 14 days and progress < 60% | medium |
| Budget overrun | category spend > 90% of budget before day 22 of the month | medium |
| Streak in danger | today unlogged, streak ≥ 7, past the reminder time | low |

Rules are persisted in `insights` so **dismiss** (permanent for that occurrence) and **snooze** (7 days) survive reloads. Maximum three warnings shown on the dashboard, highest severity first, each with a link to the screen where it can be acted on. Tone is factual, never scolding — one warning phrased badly is enough to make someone stop logging.

### 18.5 Positive signals

The same engine reports wins: new best streak, best week of the last 12, a goal completed, a habit crossing 80% completion. Warnings without wins trains avoidance.

---

## 19. Personal Score

Always available, fully transparent, fully user-editable.

### 19.1 Default weights (editable in Settings)

| Component | Weight |
|---|---:|
| Focus (study + deep work) | 30% |
| Sleep | 20% |
| Exercise | 15% |
| Habit completion | 15% |
| Reading / learning | 10% |
| Entertainment control | 10% |

### 19.2 Component functions (defaults in `score_targets`)

```text
focus        = 0.5 · min(1, study_min / 60) + 0.5 · min(1, deep_work_min / 120)

sleep(h)     = 0                        h < 4
             = (h − 4) / 3              4 ≤ h < 7
             = 1                        7 ≤ h ≤ 9
             = 1 − 0.4·(h − 9)/3        9 < h ≤ 12
             = 0.6                      h > 12

exercise(m)  = 1.0    m ≥ 30
             = 0.7    15 ≤ m < 30
             = 0.4    1 ≤ m < 15
             = 0      m = 0, unless rest-day credit applies

reading(m)   = min(1, m / 20)

habits       = completed_today / scheduled_today

entertain(m) = 1                        m ≤ 60
             = 1 − (m − 60)/120         60 < m < 180
             = 0                        m ≥ 180
```

**Rest-day credit:** if the last 7 days contain ≥ 4 exercise days, a zero-exercise day scores `0.7` instead of `0`. Rest is part of training, and a scoring model that punishes it is wrong (borrowed from Apple Fitness-style weekly targets). Configurable.

### 19.3 Aggregation

```text
day_score = 100 × Σ(wᵢ · cᵢ) / Σ(wᵢ)      over components present that day
```

**Re-normalization:** a component whose inputs are all NULL (e.g. habits when nothing is scheduled) is **dropped from both numerator and denominator** rather than counted as zero. Partially logged days are scored on what exists, and the UI labels the score with the number of components used.

### 19.4 Period scores

- `week_score` = mean of `day_score` over **logged** days, shown with a coverage badge (`5/7 days`).
- Coverage < 4 days → the number is withheld and the card shows "not enough data" instead of a misleadingly low score. Missing days are never zeros (§0.3).
- Month and year scores follow the same rule with a 40% coverage floor.

### 19.5 Transparency & storage

- Tapping any score opens a breakdown: each component's raw input, normalized value, weight, and contribution in points.
- Weights are validated to sum to 100%; a "reset to defaults" button always exists.
- **Not stored.** Scores are computed on read from `v_daily_effective`; a year of days is a trivial query. Per §24.4 of v1, caching or a materialized view is considered only after a benchmark shows a real problem.
- Every score display carries the framing from v1 §16: an operational signal, not a measure of personal worth. The UI never uses grades, faces, or red text for a low score.

---

## 20. Time, Dates & Streaks

### 20.1 Timezone and the day boundary

- `user_settings.timezone` (IANA, default `Asia/Ho_Chi_Minh`) is the only source of "today".
- `user_settings.day_rollover_hour` (0–8, **default 4**): a timestamp before this hour belongs to the **previous** logical date. Logging at 01:30 after a late night files under yesterday, which is what the user means. The daily page states which date it is writing to whenever the rollover shifts it.
- `log_date` is a **`date`**, not a timestamp — the local calendar date at entry time. It is never recomputed.
- **Changing the timezone does not rewrite history.** Past `log_date` values stay as recorded; the setting affects only future "today" resolution. The settings screen says this explicitly.
- All server-side date math goes through `lib/dates` (§26.3). Raw `new Date()` in domain or query code is banned and caught by an ESLint rule.

### 20.2 Weeks, months, years

- `week_start` setting: `monday` (default, ISO-8601) or `sunday`.
- Week key = the `date` of the week's first day; month key = first day of month; year key = integer year.
- **Rolling vs calendar is always labeled:** dashboard trends are *rolling* ("last 7 days"); reviews are *calendar* ("week of 8 Sep"). v1 used both words interchangeably; the UI must not.
- Partial current periods are marked as in-progress and excluded from "best/worst period" comparisons.

### 20.3 Streaks

For each streak type, a day is a **hit**, a **miss**, or **not scheduled** (habits only; never counted).

| Streak | Hit condition (thresholds in settings) |
|---|---|
| Logging | a daily log row exists |
| Study | `effective_study_minutes ≥ 30` |
| Deep work | `effective_deep_work_minutes ≥ 60` |
| Exercise | `exercise_minutes > 0` |
| Reading | `reading_minutes ≥ 10` |
| Habit | that habit's period target met |

Rules:
- **Today never breaks a streak.** An unlogged today is `pending`; the streak displays its current value with a subtle "log today to keep it" cue.
- **Grace / freeze (default on):** a single miss inside a rolling 7-day window does not break the streak — it pauses it (the streak does not increment). Two consecutive misses break it. This is the Duolingo-style freeze, and it directly serves v1 §26 ("allow the user to continue after missing a day"). Toggleable to strict mode in Settings.
- `best_streak` is computed under the same rule and stored nowhere — derived from history.
- After a break, the UI shows the previous best and "start again" rather than a loss message.

---

## 21. Internationalization (EN / VI)

- **Library:** `next-intl` in App Router mode, **without URL locale prefixes** — the locale comes from `user_settings.locale`, mirrored into a `locale` cookie so the very first server render is already correct. URLs stay clean (`/daily`, not `/vi/daily`), which matters for a personal tool that gets bookmarked.
- **Switcher** in the header and in Settings; switching is instant (server action writes the setting + cookie, then revalidates) with no reload and no loss of form state.
- **Messages** live in `messages/en.json` and `messages/vi.json`, namespaced per module (`daily`, `habits`, `insights`, …). `en` is the source; a CI check fails on missing or orphaned keys in `vi`, so a new string can never ship untranslated.
- **Formatting** via `Intl`, driven by locale: dates (`Sep 8, 2026` / `08/09/2026`), numbers, currency (§12), relative times ("2 days ago" / "2 ngày trước"), and weekday names. No hand-built date strings.
- **Vietnamese specifics:** no pluralization forms (avoid English plural logic leaking in), diacritic-insensitive search (`unaccent` in Postgres FTS), longer labels than English — every layout is tested with the VI strings, which are typically 15–30% wider.
- Enum values are stored as stable English keys in the database and translated at the presentation layer only. User-authored content (habit names, notes) is never translated.
- Charts, empty states, insight templates, and validation messages are all translated — including the AI analyst's output language, which follows the current locale.

---

## 22. Cross-Cutting Convenience Features

The product owner's explicit requirement: **features must be maximally convenient**. These are requirements, not polish.

### 22.1 Command palette (`Cmd/Ctrl + K`)

Fuzzy search over navigation, entities (goals, habits, projects, notes, people), and **verbs**:
`log energy 7` · `sleep 7.5` · `study 45` · `start timer deep work` · `/task fix indexing` · `/expense 45k coffee` · `/note ...` · `goto 2026-09-01`.
Executes without leaving the current page, confirms with a toast. This is the fastest path for a power user and it must exist on day one of the shell.

### 22.2 Keyboard shortcuts (desktop)

`g` then `d/h/g/p/a/r` to navigate · `n` new entry in the current module · `t` today · `[` / `]` previous/next day · `1`–`0` set the focused 1–10 metric · `s` save · `?` shortcut cheat sheet · `Esc` closes any layer.

### 22.3 Mobile ergonomics

- Bottom navigation with 5 destinations: **Home · Log · Habits · Goals · More**; everything else under More.
- Primary actions in the bottom third of the screen, within thumb reach; minimum 44×44 px targets.
- Swipe between days on the daily page; pull-to-refresh on the dashboard.
- Numeric keyboards for numeric fields (`inputMode="numeric"`), no zoom-on-focus (16 px minimum font).
- Installable PWA with offline shell, cached last dashboard, and a queued-write banner when offline (drafts are local until the connection returns).

### 22.4 Global search

One input, Postgres full-text (`tsvector` + `unaccent`, GIN indexed) across notes, journal entries, daily-log text fields, tasks, projects, goals, and people. Results grouped by type with highlighted snippets, keyboard navigable.

### 22.5 Undo & safety

- Every destructive action returns an undo toast (5 s) and archives rather than deletes where history has value.
- Bulk operations state exactly what they will touch before running.
- No confirmation dialog for anything that is undoable — dialogs for reversible actions are friction, not safety.

### 22.6 Reminders & notifications

- Local daily reminder at `reminder_time` (default 21:00) via Web Push, only if today is unlogged.
- Weekly review nudge on the first morning of the new week; monthly on the first of the month.
- Reminder items from People/CRM and tasks due today.
- All notifications are opt-in, one toggle per type, and a global quiet switch. Nothing is sent to third parties.

### 22.7 Themes & comfort

Light / dark / system; a compact-density toggle; `prefers-reduced-motion` respected; user-chosen accent colour applied through CSS custom properties.

---

## 23. Navigation & Information Architecture

### Desktop (≥1024px)

```text
+-----------------------------------------------------------------------+
| Sidebar (collapsible)  |  Header: date · search · timer · locale · ⌘K |
|  Home                  +----------------------------------------------+
|  Daily Log             |                                              |
|  Habits                |   Page content (max-width 1280, centered)    |
|  Goals                 |                                              |
|  Projects              |                                              |
|  Learning              |                                              |
|  ── Life ──            |                                              |
|  Health                |                                              |
|  Finance               |                                              |
|  Journal               |                                              |
|  Knowledge             |                                              |
|  Calendar              |                                              |
|  People                |                                              |
|  Career                |                                              |
|  ── Insight ──         |                                              |
|  Analytics             |                                              |
|  Reviews               |                                              |
|  Settings              |                                              |
+------------------------+----------------------------------------------+
```

Sidebar is grouped (Core / Life / Insight), collapsible to icons, and remembers its state. An optional right-hand detail panel opens for entity details instead of navigating away.

### Mobile (<768px)

```text
+-------------------------+      Bottom nav: Home · Log · Habits · Goals · More
| Date · search · ⌘K      |      "More" is a full-screen grid of the rest.
+-------------------------+      Sticky Save/primary action above the nav.
| Content (single column) |
+-------------------------+
| Home  Log  Hab  Goal  ⋯ |
+-------------------------+
```

Tablet (768–1023px) uses the desktop sidebar in icon-collapsed form with a two-column content grid.

---

## 24. Dashboard

### 24.1 Hierarchy (top to bottom)

1. **Today** — is today logged? If not, a two-tap inline quick-log. If yes: energy, sleep, focus, exercise, reading, entertainment as compact stat tiles with day-over-day deltas.
2. **This week** — week score with coverage, focus total vs target, exercise days, sleep average, entertainment total.
3. **Streaks** — logging, study, exercise, reading, plus the strongest habit streak.
4. **Insights** — up to three warning/win cards (§18.4–18.5).
5. **Trends** — 7/30-day toggle over focus, sleep, energy, entertainment; four small multiples, not one crowded chart.
6. **Goals** — active goals with pace indicators, at most five, sorted by urgency.
7. **Habits** — today's habit row, tappable inline.
8. **Reviews & reminders** — pending review, today's reminders, upcoming birthdays.
9. **Recent notes** — last three journal entries or notes.

Cards reflow into one column on mobile in the same order. Users can hide any card (Settings); drag-and-drop reordering is post-launch backlog.

### 24.2 Discipline

Every card must answer one of the three v1 questions — *How am I doing? What is improving? What is hurting me?* A chart that answers none of them does not ship. Card count is deliberately capped.

---

## 25. Technical Stack

| Concern | Choice | Note |
|---|---|---|
| Framework | **Next.js (App Router)**, React Server Components | Server Actions for mutations |
| Language | **TypeScript**, `strict: true`, no `any` in domain code | |
| Database | **PostgreSQL 16** | source of truth |
| ORM | **Drizzle ORM** + `drizzle-kit` | decision #2 |
| Driver | `postgres.js`, single pool | |
| Validation | **Zod**, one schema per boundary, inferred types | |
| UI | **Tailwind CSS** + **shadcn/ui** (Radix primitives) | accessible by default |
| Charts | **Recharts** | wrapped in project chart components, never used raw |
| i18n | **next-intl** | §21 |
| Forms | `react-hook-form` + `zodResolver` | |
| Dates | `date-fns` + `date-fns-tz` | wrapped by `lib/dates` |
| Tables | `@tanstack/react-table` for dense views | |
| Markdown | `react-markdown` + `remark-gfm`, `shiki` for code | |
| Icons | `lucide-react` | |
| Logging | `pino` (structured JSON) | §30 |
| Tests | **Vitest** (unit/integration) + **Playwright** (E2E) | §31 |
| Lint/format | ESLint (with local rules) + Prettier | |
| Runtime | Node 22 LTS | |
| Packaging | Docker + Docker Compose | §34 |

**Deliberately absent:** Redis, Kafka, Elasticsearch, ClickHouse, microservices, a separate backend service, a global client state library (RSC + Server Actions + `useOptimistic` cover it), and any analytics/telemetry SDK — this is private data.

---

## 26. Architecture

### 26.1 Layers

```text
app/ (routes, RSC)  ──▶  features/<module>/ (UI + hooks)
                              │
                              ▼
                    server/services/  (domain logic, transactions)
                              │
                              ▼
                    server/repositories/  (Drizzle queries only)
                              │
                              ▼
                         PostgreSQL
```

Rules:
- **No business logic in components.** Components render and dispatch.
- **No SQL outside repositories.** Services compose repositories.
- **Validate at every boundary** with Zod: Server Action inputs, API route bodies, import files, env vars (`lib/env.ts` parses `process.env` once at boot and fails fast).
- **Transactions** wrap every multi-write operation (daily log + derived habit logs; goal + milestones; transfer transactions).
- **Invariants in the database**: uniqueness, foreign keys, and `CHECK` constraints exist even though the app also validates. Two locks on the door.
- Domain logic is **pure functions** over plain data (scoring, streaks, insights, correlations) so it is unit-testable without a database — this is what §31 tests.

### 26.2 Module contract

Each module owns `features/<module>/` (components, hooks, client logic), `server/services/<module>.ts`, `server/repositories/<module>.ts`, its tables in `lib/db/schema/<module>.ts`, and its i18n namespace. Cross-module access goes through the service layer's exported functions only — never another module's repository, never a direct import of its internals. Adding a module must not require editing another module.

### 26.3 `lib/` utilities

`db/` (client, schema, migrations) · `auth/` (current-user shim, §29) · `validation/` (shared Zod pieces) · `dates/` (timezone, rollover, week/month keys, ranges — the *only* place date math lives) · `analytics/` (pure statistics: buckets, Pearson, moving averages) · `scoring/` (pure score functions) · `streaks/` (pure streak functions) · `i18n/` · `format/` (locale-aware display) · `logger.ts` · `env.ts`.

### 26.4 Extensibility rules

Registries, not switch statements: metrics, score components, insight rules, and navigation entries are declared in typed registries so a new metric or rule is one object, not edits across ten files. New modules register their nav entry, their search providers, and their insight rules.

---

## 27. Database Design

Conventions: `id` = `uuid` default `gen_random_uuid()`; every user-owned table has `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`; `created_at`/`updated_at timestamptz NOT NULL DEFAULT now()` with `updated_at` maintained by a trigger; enums as Postgres `enum` types where the set is closed, `text` + `CHECK` where the user may extend; money as `numeric(14,2)`; durations as integer minutes; soft-archive via `archived_at timestamptz NULL`.

### 27.1 Core

| Table | Key columns |
|---|---|
| `users` | `display_name`, `email?` (unused until auth) |
| `user_settings` | `user_id PK`, `locale`, `timezone`, `day_rollover_hour`, `week_start`, `theme`, `density`, `accent`, `unit_system`, `default_currency`, `score_weights jsonb`, `score_targets jsonb`, `streak_thresholds jsonb`, `streak_grace_enabled`, `insight_thresholds jsonb`, `reminder_time`, `notification_prefs jsonb`, `dashboard_cards jsonb` |
| `daily_logs` | §5.1 columns + `source`, `UNIQUE(user_id, log_date)` |
| `custom_metrics` | `key`, `label_en`, `label_vi`, `type` (`number\|boolean\|scale\|text`), `unit`, `min`, `max`, `aggregation`, `sort_order`, `archived_at` |
| `custom_metric_values` | `PK(daily_log_id, custom_metric_id)`, `value_numeric`, `value_bool`, `value_text` |

### 27.2 Custom metrics

Core metrics stay as typed columns (fast, constrained, indexable). User-defined metrics use the two tables above — the flexible path exists, but **the system is not JSONB** (v1 §10). Custom metrics can be scored (weight in `score_weights`), streaked, graphed, and linked from habits and goals via `custom:<key>`.

### 27.3 Views

```sql
-- The single read path for all analytics, scoring, streaks and reviews.
CREATE VIEW v_daily_effective AS
SELECT d.*,
       COALESCE(fs.learning_minutes,  d.technical_study_minutes) AS effective_study_minutes,
       COALESCE(fs.execution_minutes, d.deep_work_minutes)       AS effective_deep_work_minutes
FROM daily_logs d
LEFT JOIN (
  SELECT user_id, session_date,
         SUM(minutes) FILTER (WHERE kind = 'learning')                 AS learning_minutes,
         SUM(minutes) FILTER (WHERE kind IN ('deep_work','project'))    AS execution_minutes
  FROM focus_sessions GROUP BY user_id, session_date
) fs ON fs.user_id = d.user_id AND fs.session_date = d.log_date;
```

`focus_sessions.session_date` is a stored logical date (rollover-aware) so this join needs no timezone math.

### 27.4 Domain tables

**Habits:** `habits` (§7.1–7.3 columns incl. `frequency_type`, `target_count`, `weekdays smallint[]`, `interval_days`, `linked_metric`, `linked_operator`, `linked_threshold`) · `habit_logs` (`habit_id`, `log_date`, `count`, `completed`, `source`, `note`, `UNIQUE(habit_id, log_date)`).

**Goals:** `goals` (§8.1–8.2 incl. `progress_mode`, `progress_manual`, `metric_key`, `metric_aggregation`, `metric_period`, `metric_target`, `metric_direction`, `recurrence`, `project_id?`) · `goal_milestones` (`title`, `due_date`, `completed_at`, `weight`, `sort_order`).

**Projects:** `projects` · `project_tasks` (`parent_task_id` self-FK).

**Learning:** `focus_sessions` · `topics` (`parent_id`, depth ≤ 2) · `resources`.

**Knowledge:** `notes` (`body_md`, `search_tsv` generated) · `tags` · `note_tags` · `note_links` · `journal_entries`.

**Health:** `workouts` · `workout_sets` · `body_measurements` (`UNIQUE(user_id, measured_on)`) · `nutrition_logs`.

**Finance:** `accounts` · `finance_categories` · `transactions` · `recurring_transactions` · `budgets` (`UNIQUE(user_id, category_id, period_start)`) · `assets` · `investments`.

**Calendar:** `events` · `planned_blocks`.

**People:** `people` · `interactions` · `reminders`.

**Career:** `skills` · `achievements` · `portfolio_items`.

**Reviews:** `weekly_reviews` · `monthly_reviews` · `yearly_reviews` (each with `metrics_snapshot jsonb`, `snapshot_version`, `finalized_at`).

**System:** `insights` (`kind`, `severity`, `payload jsonb`, `period_start`, `period_end`, `generated_at`, `dismissed_at`, `snoozed_until`) · `attachments` (`entity_type`, `entity_id`, `filename`, `mime`, `size_bytes`, `storage_path`) · `push_subscriptions` · `ai_reports` (`kind`, `period`, `model`, `prompt_version`, `content_md`) · `timer_state` (`user_id PK`, running session fields).

### 27.5 Constraints (examples, all enforced)

```sql
ALTER TABLE daily_logs
  ADD CONSTRAINT daily_logs_user_date_uniq UNIQUE (user_id, log_date),
  ADD CONSTRAINT energy_range      CHECK (energy IS NULL OR energy BETWEEN 1 AND 10),
  ADD CONSTRAINT mood_range        CHECK (mood   IS NULL OR mood   BETWEEN 1 AND 10),
  ADD CONSTRAINT sleep_range       CHECK (sleep_hours IS NULL OR sleep_hours BETWEEN 0 AND 24),
  ADD CONSTRAINT minutes_range     CHECK (technical_study_minutes IS NULL OR technical_study_minutes BETWEEN 0 AND 1440),
  ADD CONSTRAINT no_future_log     CHECK (log_date <= CURRENT_DATE + 1);  -- +1 tolerates timezone skew
```

Also: `habit_logs.count >= 0`; `goals.progress_manual BETWEEN 0 AND 100`; `focus_sessions.minutes BETWEEN 1 AND 1440`; `transactions.amount > 0`; `transactions` transfer rows require `counter_account_id IS NOT NULL` and a different account; `goal_milestones.weight > 0`; `custom_metric_values` requires exactly one non-null value column.

### 27.6 Indexes (based on the actual query patterns)

```sql
CREATE INDEX idx_daily_logs_user_date       ON daily_logs(user_id, log_date DESC);
CREATE INDEX idx_habit_logs_habit_date      ON habit_logs(habit_id, log_date DESC);
CREATE INDEX idx_habit_logs_user_date       ON habit_logs(user_id, log_date DESC);
CREATE INDEX idx_focus_sessions_user_date   ON focus_sessions(user_id, session_date DESC);
CREATE INDEX idx_focus_sessions_project     ON focus_sessions(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX idx_tasks_project_status       ON project_tasks(project_id, status);
CREATE INDEX idx_goals_user_status          ON goals(user_id, status);
CREATE INDEX idx_transactions_user_date     ON transactions(user_id, occurred_on DESC);
CREATE INDEX idx_transactions_category      ON transactions(category_id, occurred_on DESC);
CREATE INDEX idx_journal_user_date          ON journal_entries(user_id, entry_date DESC);
CREATE INDEX idx_notes_search               ON notes USING GIN (search_tsv);
CREATE INDEX idx_insights_user_active       ON insights(user_id, generated_at DESC) WHERE dismissed_at IS NULL;
CREATE INDEX idx_reminders_due              ON reminders(user_id, due_at) WHERE done_at IS NULL;
```

No index is created for a column without a query that needs it. New indexes require an `EXPLAIN` in the pull request description.

---

## 28. Application Operations

Mutations are **Server Actions** (typed, Zod-validated, revalidating). REST routes exist only where a non-React client needs them.

**Daily:** `upsertDailyLog(date, patch)` (transactional; recomputes linked habit logs) · `getDailyLog(date)` · `getDailyLogs(range)` · `copyPreviousDay(date)` · `bulkUpsertDailyLogs(rows)` (catch-up) · `deleteDailyLog(date)`.

**Habits:** `createHabit` · `updateHabit` (recomputes derived history on binding change) · `archiveHabit` · `deleteHabit` · `toggleHabitLog(habitId, date, count?)` · `getHabitMatrix(range)`.

**Goals:** `createGoal` · `updateGoal` · `setManualProgress` · `upsertMilestone` · `toggleMilestone` · `completeGoal` · `rollForwardRecurringGoal`.

**Projects:** `createProject` · `updateProject` · `upsertTask` · `moveTask` · `bulkCompleteTasks`.

**Learning:** `startTimer` · `stopTimer` · `upsertFocusSession` · `deleteFocusSession` · `upsertTopic` · `upsertResource`.

**Health / Finance / Calendar / People / Career / Knowledge:** standard `create`/`update`/`archive` per entity, plus `recordTransfer`, `materializeRecurring`, `upsertBudget`, `logInteraction`, `upsertNote` (re-indexes search, resolves wiki-links).

**Analytics:** `getDashboard(date)` (one call, one round trip, everything the dashboard needs) · `getTrends(metrics, range, granularity)` · `getComparison(metricA, metricB, range)` · `getTimeAllocation(range)` · `getInsights(date)` · `dismissInsight` · `snoozeInsight`.

**Reviews:** `getReviewDraft(period, key)` · `upsertReview` · `finalizeReview` · `recomputeReviewSnapshot`.

**System:** `updateSettings` · `setLocale` · `exportData(format, scope)` · `importData(file, mapping)` · `wipeDemoData` · `GET /api/health` · `GET /api/calendar.ics` · `POST /api/cron/daily` (reminders, recurring materialization, insight generation).

---

## 29. Auth — Deferred, but Modeled

**Decision:** no authentication in this build (owner decision #1).

How it is structured so adding auth later is a small change:

- A single row exists in `users`, seeded by migration with a fixed UUID; `lib/auth/current-user.ts` exports `getCurrentUserId()` returning it.
- **Every** repository function still takes `userId` and every query still filters on it. No query anywhere omits the owner predicate, even though there is one owner today.
- No `user_id` ever arrives from the client. Server Actions read it from `getCurrentUserId()` — the same rule as v1 §17, so the shim can later become a session lookup and nothing else changes.
- Adding auth = implement `getCurrentUserId()` against a session, add login routes, add rate limiting. No schema migration, no query rewrites.

**Security posture without auth (must be documented in the README):**

- The app binds to `127.0.0.1` by default in Docker Compose; the Postgres port is not published.
- **Deploying this on a public URL without auth exposes all personal data.** If it must leave the machine, put it behind a private network (Tailscale/VPN), a reverse-proxy with HTTP basic auth, or implement §29's auth step first. The README states this in a warning block, and `/api/health` is the only endpoint safe to expose.
- Still applies now: Zod validation on every input, secrets only in env vars, no telemetry, no third-party requests with personal data, parameterized queries only (Drizzle), and CSP/security headers set in `next.config`.
- AI features (§35 phase 13) are **off by default**; enabling them sends the selected period's aggregates to the configured provider, and the settings screen says exactly what leaves the machine before the toggle can be turned on.

---

## 30. Observability & Reliability

- **Structured logs** (`pino`, JSON): request id, route, duration, user id, outcome. No personal note content in logs, ever.
- **Error tracking:** an error boundary per route group, a server error handler that logs with a correlation id shown to the user. Sentry is optional and self-host-friendly, off by default (privacy).
- **Query monitoring:** dev-mode slow-query log (> 100 ms) with the statement; `pg_stat_statements` enabled in the Compose Postgres image.
- **Health endpoint:** `GET /api/health` → app version, migration status, DB round-trip time.
- **Latency metrics:** middleware timing per route logged, plus a dev overlay showing server timing.
- **Backups:** `scripts/backup.sh` (`pg_dump` custom format, timestamped, retention configurable) and `scripts/restore.sh`, both documented and both **tested by an integration test that restores into a scratch database** — a backup procedure that has never been restored is not a backup procedure.

---

## 31. Testing

### 31.1 Unit (Vitest, no database)

Pure domain functions: score components and aggregation (including re-normalization and coverage floors) · streaks (grace window, pending today, not-scheduled days) · habit scheduling for all four frequency types · goal progress in all three modes including `at_most` · date utilities (timezone, rollover, week/month keys, ranges) · analytics statistics (buckets, Pearson, moving average) · insight rules against synthetic series · **i18n guards**: key parity between `en` and `vi`, and the causal-verb ban in insight/correlation namespaces (§18.3).

### 31.2 Integration (Vitest + real Postgres in Docker)

Repositories and services against a real database: upsert semantics, the daily-log + derived-habit transaction (including rollback on failure), every `CHECK` and `UNIQUE` constraint rejecting bad data, `v_daily_effective` precedence, transfer transactions balancing, review finalize/recompute, and migration up/down on an empty database.

### 31.3 Action / API

Input validation rejects malformed payloads · ownership predicates present on every query (a test that greps repositories for a `userId` filter, since there is no auth to catch mistakes) · a client-supplied `user_id` is ignored · rate-limited endpoints behave.

### 31.4 E2E (Playwright)

Critical path: `open app → log today → save → dashboard updates`. Plus: edit a past day · catch-up flow for 3 missing days · create habit → auto-complete from daily log · create metric goal → progress moves after logging · weekly review draft → finalize → numbers frozen · locale switch EN↔VI keeps state and translates everything · mobile viewport daily entry under the interaction budget · keyboard-only navigation of the daily form.

### 31.5 Required edge cases (explicit tests)

Timezone changes · the rollover hour boundary · DST-shifting timezones · month and year boundaries · ISO week 1 and 53 · leap day (29 Feb) · missing days inside every aggregation · duplicate daily-log attempts · editing history that a finalized review depends on · NULL-vs-zero handling in every average · very long Vietnamese strings in every layout · a 5-year dataset for query performance.

### 31.6 Performance budget

`getDashboard` < 150 ms server time on 3 years of seed data; any analytics query < 300 ms; daily-log save < 100 ms. Benchmarks live in `tests/perf` and run in CI. These numbers are the trigger for caching decisions (§25), not guesswork.

---

## 32. Seed & Demo Data

- `pnpm db:seed` generates **90 days** by default (`--days` to change, up to 3 years for performance work) of deliberately imperfect data: weekday/weekend patterns, a two-week slump, a strong streak that breaks once, missing days, occasional double-logged reflections, seasonal drift in sleep.
- Correlations are **planted with noise** so the analytics engine has something real but not clean to find (sleep→energy positive, entertainment→study negative).
- Seeds cover every module: habits with all four frequency types, goals in all three progress modes, projects with tasks and sessions, transactions across categories with budgets, workouts and measurements, notes with links and tags, people with interactions, one finalized weekly review and one draft.
- Idempotent and reproducible: a fixed RNG seed, and `db:reset` = drop → migrate → seed.
- Demo data is tagged (`source='import'` / a `demo` flag) so `wipeDemoData()` removes it cleanly without touching real entries.

---

## 33. Import / Export & Data Portability

- **Export:** full JSON dump (schema-versioned, restorable) and per-module CSV. One click in Settings, streamed, no size limit.
- **Import:** the same JSON format (round-trip guaranteed by test) plus generic CSV import with an interactive column mapper, a dry-run preview showing what will be created/updated/skipped, and per-row error reporting instead of an all-or-nothing failure.
- Attachment files are included in a `.zip` alongside the JSON.
- Schema version is recorded in every export; the importer migrates older versions forward.
- This satisfies v1 §17's portability requirement and is a hard requirement, not a backlog item: the user's data must be removable from this app at any time.

---

## 34. Deployment

**Primary target — Docker Compose (self-host):**

```text
docker compose up -d      # app (127.0.0.1:3000) + postgres:16 (not published)
docker compose exec app pnpm db:migrate
docker compose exec app pnpm db:seed   # optional demo data
```

- Multi-stage `Dockerfile` (deps → build → runtime), Next.js standalone output, non-root user, healthcheck.
- Migrations run explicitly (never automatically on boot).
- `.env.example` documents every variable; `lib/env.ts` validates them and refuses to start on a missing one.
- Nightly backup via a cron entry calling `scripts/backup.sh` into a mounted volume.

**Alternative — Vercel + managed Postgres (Neon/Supabase):** supported; requires the pooled connection string and the auth warning in §29 taken seriously, since a public URL with no auth is open data. `POST /api/cron/daily` is wired for a scheduled trigger in both targets.

**Documented steps** (README): clone → copy env → compose up → migrate → open. A clean machine must reach a working app with no undocumented step (v1 acceptance criterion).

---

## 35. Build Order

Each phase ends shippable and usable.

| Phase | Scope |
|---|---|
| 0 | Foundation: Next.js + TS + Tailwind + shadcn, Drizzle + Postgres + migrations, env validation, i18n (EN/VI) with switcher, responsive shell (sidebar + bottom nav), theme, user + settings seed, `getCurrentUserId()` shim, health endpoint, test harness |
| 1 | Daily Log: schema, fast entry UX (§6), history list, calendar heatmap, edit any day, copy-yesterday, drafts, catch-up |
| 2 | Dashboard: today tiles, week numbers, score engine (§19), streaks (§20.3), 7/30-day trends, quick-log |
| 3 | Habits & Goals: all frequency types, metric-linked auto-completion, grid + heatmap, goals with three progress modes, milestones, pace |
| 4 | Learning & Projects: focus sessions, timer, topics, resources, projects, tasks, project time |
| 5 | Reviews: weekly/monthly/yearly, draft vs finalized snapshot, carry-forward priority |
| 6 | Analytics & Insights: trend views, comparisons, correlation engine with gates, warning + win rules, time allocation |
| 7 | Command palette, global search, keyboard shortcuts, PWA + offline drafts |
| 8 | Health: workouts, sets, measurements, nutrition |
| 9 | Finance: accounts, categories, transactions, transfers, budgets, recurring, net worth, investments |
| 10 | Journal & Knowledge: Markdown editor, notes, tags, wiki-links, bookmarks, resources |
| 11 | Calendar & Planning: events, planned blocks, plan-vs-actual, ICS export |
| 12 | People & Career: CRM, interactions, reminders, stay-in-touch, skills, achievements, portfolio |
| 13 | System: notifications/reminders delivery, import/export, backup/restore, attachments |
| 14 | AI Analyst (opt-in): narrative weekly/monthly review, anomaly notes, trend explanations, natural-language questions over the user's own data — grounded strictly in retrieved aggregates, always labeled as generated, always non-causal (§18.3). Verify current model ids and pricing at implementation time |
| 15 | Auth (when the app leaves localhost): session, login, rate limiting — `getCurrentUserId()` becomes real |

Phases 0–7 are the core product; 8–15 extend it without touching it.

---

## 36. Acceptance Criteria (full product)

**Core loop**
- [ ] A full day can be logged in under 60 seconds on a phone, verified by an E2E interaction-count test.
- [ ] Any past day is editable; drafts survive a refresh; save offers undo.
- [ ] Missing days can be back-filled from one catch-up screen.
- [ ] The dashboard updates immediately after saving.
- [ ] Trends support 7 / 30 / 90 / 365-day ranges.
- [ ] Every weekly and monthly number is derived from raw daily data; finalized reviews keep a frozen snapshot.
- [ ] Streaks implement the grace rule and never count today as a miss.
- [ ] The score is transparent: every displayed score opens a full component breakdown, and weights are editable.
- [ ] Goals show automatic progress in `metric` and `milestones` modes with real numbers, not bare percentages.
- [ ] Metric-linked habits complete themselves from the daily log with no double entry.
- [ ] Insights never use causal language, and never appear below the minimum-sample gates — both enforced by tests.

**Breadth**
- [ ] Health, Finance, Knowledge, Journal, Calendar, People, and Career modules are each usable end to end.
- [ ] Global search returns results across all text-bearing modules, diacritic-insensitively.
- [ ] The command palette can log a metric, start a timer, and create a task, goal, note, and expense.

**Quality**
- [ ] Full EN/VI parity; switching locale is instant and loses no state; CI fails on a missing translation key.
- [ ] Works at 320 px through desktop with no horizontal scrolling; installable as a PWA; usable with keyboard only; WCAG 2.1 AA contrast and focus visibility.
- [ ] Migrations and seed data are reproducible from an empty database.
- [ ] Domain logic (scoring, streaks, habits, goals, dates, analytics) has unit tests; constraints and transactions have integration tests; the critical path has E2E tests.
- [ ] Performance budgets in §31.6 are met on 3 years of data.
- [ ] Full JSON export re-imports to an identical dataset (round-trip test).
- [ ] Backup and restore scripts are documented and covered by a restore test.
- [ ] A clean machine deploys the app using only the README.
- [ ] The README carries the "no auth — do not expose publicly" warning.

---

## 37. Backlog (explicitly after launch)

Drag-and-drop dashboard widgets · natural-language date parsing in the palette · wearable/health-API import (Apple Health, Google Fit, Garmin) · bank statement auto-categorization · two-way calendar sync · offline write queue with conflict resolution · shared/multi-user mode · mobile native wrapper · habit templates library · advanced saved filters and custom dashboards · goal dependency graphs.

---

## 38. Engineering Principles

1. **Convenience is a requirement.** If logging a day takes longer than it did last month, that is a regression.
2. **Data first, dashboard second.** Correct, well-modeled data outlives every chart.
3. **PostgreSQL is the source of truth.** All personal data lives there, and it is enough.
4. **Derive, don't duplicate.** Scores, streaks, progress, and review numbers are computed from raw logs. Materialize only after a benchmark says so.
5. **NULL is not zero.** Not logging is different from logging a zero, everywhere.
6. **Modules, not infrastructure.** Breadth comes from new modules; no Redis, Kafka, Elasticsearch, ClickHouse, or microservices without a measured need.
7. **Next.js fullstack is intentional.** No separate backend service just because the author writes backends.
8. **Own the boundaries.** Validate every input, derive ownership server-side, keep SQL in repositories, keep logic out of components.
9. **Never shame the user.** The score is an operational signal. Missed days are normal. A tool that judges gets abandoned, and an abandoned tool has no data.
10. **Correlation is not causation** — in the analytics, in the AI output, and in the copy.

> **Start as a modular monolith, keep PostgreSQL as the source of truth, keep the daily log ruthlessly fast, and let real usage decide where complexity is justified.**
