# Personal OS – Product Requirements & Technical Specification

**Stack:** Next.js Fullstack + TypeScript + PostgreSQL  
**Architecture:** Modular Monolith  
**UI:** Responsive Web App  
**Roadmap:** MVP → Extensible Personal Management System

---

## 1. Product Vision

Build a personal operating system for tracking daily performance, understanding behavior, managing goals and projects, and gradually expanding into a broader system for managing the user's own life.

The first version must make daily tracking extremely fast and analysis useful.

> **Core principle: Data first, dashboard second.**

## 2. Product Goals

- Record daily behavior and performance in under 1–2 minutes.
- Track career/learning, health, lifestyle, finance, and knowledge over time.
- Show trends rather than only raw records.
- Identify repeated bad habits and possible correlations between habits and performance.
- Support measurable goals and progress.
- Provide weekly and monthly reviews.
- Work well on desktop and mobile.
- Use a modular architecture so future personal-management features can be added safely.

## 3. Non-Goals for MVP

- No social network.
- No generic Jira-like project management suite.
- No complex investment trading functionality initially.
- No AI everywhere before enough personal data exists.
- Do not optimize for multi-user SaaS initially, but model ownership explicitly.

## 4. Main Modules

- Dashboard
- Daily Log
- Goals
- Habits
- Projects
- Learning / Knowledge
- Health
- Finance
- Journal / Notes
- Analytics
- Reviews
- Settings

---

## 5. MVP Requirements

### 5.1 Daily Log

| Metric | Type | Example | Priority |
|---|---|---|---|
| Date | date | 2026-09-07 | Required |
| Energy | integer 1–10 | 7 | Required |
| Sleep duration | decimal hours | 7.5 | Required |
| Technical study | minutes | 60 | Required |
| Deep work | minutes | 90 | Recommended |
| Exercise | boolean + duration/type | Running, 30m | Recommended |
| Reading | minutes or pages | 20m / 10 pages | Recommended |
| Entertainment / gaming | minutes | 90 | Recommended |
| English practice | minutes | 20 | Optional |
| Mood | integer 1–10 | 8 | Optional |
| Daily win | text | Finished DB indexing task | Optional |
| Daily problem | text | Too much YouTube | Optional |
| Tomorrow priority | text | Study MVCC | Optional |
| Free-form note | text | Anything relevant | Optional |

### 5.2 Fast Daily Entry UX

- Primary **Log today** action.
- Pre-fill today's date.
- Use sliders/steppers for 1–10 metrics.
- Quick toggle for exercise.
- Numeric inputs for minutes.
- Autosave or explicit Save with clear feedback.
- Allow editing previous days.
- Allow copying previous-day values where useful.
- Mobile daily entry should require minimal navigation.

### 5.3 Dashboard

Dashboard should answer:

1. How am I doing?
2. What is improving?
3. What is hurting my performance?

Features:

- Today's status: energy, sleep, study, exercise, reading, entertainment.
- Current streaks: daily logging, exercise, reading, study.
- Weekly score, with transparent formula if enabled.
- 7-day and 30-day trends.
- Study/deep-work trend.
- Sleep trend.
- Exercise frequency.
- Entertainment trend.
- Goal progress.
- Recent notes.
- Warnings for repeated negative patterns.

### 5.4 Weekly Review

- Average energy and sleep.
- Total technical study and deep work.
- Exercise count.
- Reading total.
- Entertainment total.
- Best and worst day.
- What worked?
- What did not work?
- What should change next week?
- Top priority for next week.
- Free-form reflection.

### 5.5 Goals

Each goal should support:

- Name.
- Description.
- Category.
- Start date.
- Target date.
- Status: `active / completed / paused / cancelled`.
- Progress percentage.
- Optional metric target, e.g. `300 study minutes/week`.
- Milestones.
- Notes.

Suggested categories:

- Career
- Health
- Finance
- Knowledge
- Life

### 5.6 Habits

- Name.
- Category.
- Frequency: `daily / weekly / custom`.
- Target count.
- Active period.
- Completion history.
- Current streak.
- Best streak.

### 5.7 Projects

Projects can represent personal projects, work-learning projects, or long-running goals.

- Project name.
- Description.
- Status.
- Priority.
- Start/end dates.
- Tasks.
- Milestones.
- Time spent.
- Notes.

---

## 6. Analytics

Support:

- 7/30/90-day trend views.
- Weekly and monthly averages.
- Study time by category.
- Habit completion rate.
- Sleep vs energy.
- Sleep vs study performance.
- Exercise vs energy.
- Entertainment vs study time.
- Goal completion rate.
- Time allocation by category.

### Analytics rule

Analytics must distinguish **correlation from causation**.

Good:

> Average energy was higher on days with at least 7 hours of sleep.

Bad:

> Sleeping 7 hours caused higher productivity.

---

## 7. Future Modules

The architecture should allow future modules such as:

- Personal finance:
  - Income
  - Expenses
  - Savings
  - Assets
  - Liabilities
  - Investments
- Knowledge base:
  - Notes
  - Bookmarks
  - Concepts
  - Books
  - Courses
- Calendar and time planning.
- Personal CRM:
  - People
  - Interactions
  - Reminders
- Health details:
  - Workouts
  - Measurements
  - Nutrition
- Career management:
  - Skills
  - Achievements
  - Portfolio
  - Career goals
- Travel and life events.
- File/document organization.
- AI personal analyst:
  - Weekly review
  - Anomaly detection
  - Trend explanations
- Notifications and reminders.
- Import/export.

---

## 8. Technical Stack

### Required

- **Next.js**
- **TypeScript**
- **Next.js App Router**
- **PostgreSQL**

### Recommended

- ORM: **Prisma** or **Drizzle**
- Validation: **Zod**
- UI: **Tailwind CSS + shadcn/ui**
- Charts: **Recharts** or equivalent
- Authentication/session layer
- Docker-friendly deployment

---

## 9. Architecture Principles

Use a **modular monolith**.

### Rules

- Keep domain logic separate from UI components.
- Do not put business logic directly in React components.
- Validate inputs at application boundaries.
- Use database transactions for atomic operations.
- Use PostgreSQL constraints for invariants.
- Store user timezone in settings.
- Handle date boundaries explicitly.
- Prefer deriving analytics from source data instead of duplicating aggregates prematurely.
- Add indexes according to real query patterns.
- Keep modules independently extensible.

### Important

Do **not** introduce Redis, Kafka, Elasticsearch, ClickHouse, or microservices just because they are familiar technologies.

Start with:

```text
Next.js
   |
   +-- Application / Domain
   |
   +-- PostgreSQL
```

Only add infrastructure when a real requirement appears.

---

## 10. Proposed Database Model

| Entity | Purpose |
|---|---|
| `users` | Identity and ownership |
| `user_settings` | Timezone and preferences |
| `daily_logs` | One row per user per date |
| `daily_metrics` | Optional flexible custom metrics |
| `habits` | Habit definitions |
| `habit_logs` | Habit completion records |
| `goals` | Goals |
| `goal_milestones` | Goal milestones |
| `projects` | Personal projects |
| `project_tasks` | Project tasks |
| `study_sessions` | Detailed learning sessions |
| `journal_entries` | Long-form reflections |
| `weekly_reviews` | Weekly reflection and aggregates |
| `monthly_reviews` | Monthly reflection and aggregates |

### Database design recommendation

Keep stable core metrics normalized in `daily_logs`.

Only introduce a flexible `daily_metrics` table when custom metrics are actually needed.

**Do not make the entire system JSONB just because future fields may appear.**

---

## 11. Database Constraints & Indexes

### Constraints

- `UNIQUE(user_id, log_date)` on `daily_logs`.
- Foreign keys from user-owned records to `users`.
- `CHECK` constraints for bounded values such as energy `1–10`.
- Consistent `created_at` and `updated_at`.

### Indexes

Typical initial index:

```sql
CREATE INDEX idx_daily_logs_user_date
ON daily_logs(user_id, log_date DESC);
```

Do not blindly create indexes for every column. Base indexes on actual query patterns.

---

## 12. Application Operations

The application should support:

### Daily

- Create/update today's daily log.
- Get daily log by date.
- Get daily logs by date range.

### Habits

- Create habit.
- Update habit.
- Delete/deactivate habit.
- Mark habit complete for a date.

### Goals

- Create goal.
- Update goal.
- Update goal progress.
- Create/update milestones.

### Projects

- Create/update project.
- Create/update project task.

### Learning

- Record study session.

### Analytics

- Get dashboard summary.
- Get analytics for a date range.

### Reviews

- Create/update weekly review.
- Create/update monthly review.

---

## 13. Responsive Requirements

The application must be fully responsive.

### Target breakpoints

| Device | Width |
|---|---:|
| Mobile | ~320–767px |
| Tablet | ~768–1023px |
| Desktop | ≥1024px |

### Requirements

- Dashboard cards reflow without horizontal scrolling.
- Daily logging must be especially fast on mobile.
- Use bottom navigation or compact navigation on mobile.
- Convert large tables into cards or controlled horizontal scrolling where necessary.
- Charts must remain readable on small screens.
- Touch targets must be comfortably tappable.
- Do not rely on hover-only interactions.
- Support keyboard navigation on desktop.

---

## 14. UI Layout

### Desktop

```text
+-------------------------------------------------------+
| Sidebar |                 Main Content                 |
|         |                                             |
|         |        Dashboard / Page Content             |
|         |                                             |
|         |                                             |
+-------------------------------------------------------+
```

Use:

- Left sidebar navigation.
- Main content area.
- Optional contextual detail panel.

### Mobile

```text
+-------------------------+
| Header                  |
+-------------------------+
|                         |
| Main Content            |
|                         |
|                         |
+-------------------------+
| Home | Log | Goals | ...|
+-------------------------+
```

Use:

- Compact top header.
- Main content.
- Bottom navigation with 4–5 primary destinations.
- Secondary modules under `More`.

---

## 15. Dashboard Hierarchy

The dashboard should prioritize information in this order:

1. Today's status.
2. Key weekly numbers.
3. Trends.
4. Goals.
5. Habits.
6. Reviews and reminders.

Avoid filling the dashboard with charts simply because charts are available.

---

## 16. Optional Personal Score

If a personal score is implemented, make the formula transparent.

Example:

| Category | Weight |
|---|---:|
| Study / deep work | 30% |
| Sleep | 20% |
| Exercise | 15% |
| Reading / learning | 10% |
| Habit completion | 15% |
| Entertainment control | 10% |

The score is an **operational signal**, not a measure of personal worth.

---

## 17. Authentication & Security

Requirements:

- Protect every personal-data endpoint.
- Derive ownership from the authenticated session, not a client-supplied `user_id`.
- Validate all input.
- Use secure cookie/session practices.
- Rate-limit authentication endpoints.
- Keep secrets in environment variables.
- Back up PostgreSQL regularly.
- Provide data export so personal data is portable.

---

## 18. Observability & Reliability

Initial requirements:

- Structured server logs.
- Error tracking.
- Database query monitoring.
- Health endpoint.
- Basic request latency metrics.
- Documented database backup/restore procedure.

---

## 19. Testing

### Unit tests

Test:

- Scoring.
- Analytics.
- Streak calculation.
- Date calculations.
- Domain rules.

### Integration tests

Test:

- PostgreSQL operations.
- Transactions.
- Constraints.

### Application/API tests

Test:

- Authorization.
- Input validation.
- Ownership boundaries.

### E2E

Critical path:

```text
Open app
   ↓
Log today
   ↓
Save
   ↓
Dashboard updates
```

### Important edge cases

Explicitly test:

- Timezones.
- Midnight/date boundaries.
- Month boundaries.
- Missing days.
- Leap years.
- Duplicate daily logs.
- Editing historical data.

---

## 20. Seed Data

Provide:

- 30–90 days of realistic seed data.
- Imperfect variation instead of perfect habits.
- Enough variation to test:
  - Charts
  - Streaks
  - Reviews
  - Analytics
  - Correlations

---

## 21. Development Phases

| Phase | Name | Scope |
|---|---|---|
| 0 | Foundation | Next.js, TypeScript, PostgreSQL, ORM, auth, migrations, responsive shell |
| 1 | Daily Tracking | `daily_logs`, fast input, history, edit |
| 2 | Dashboard | Today summary, weekly metrics, charts, streaks |
| 3 | Habits & Goals | Habit logs, goals, milestones |
| 4 | Learning & Projects | Study sessions, projects, tasks |
| 5 | Reviews | Weekly/monthly review workflows |
| 6 | Analytics | 30/90-day trends, correlations, time allocation |
| 7 | Expansion | Finance, knowledge base, calendar, personal CRM |
| 8 | AI | AI-assisted reviews and analysis after sufficient historical data |

---

## 22. MVP Acceptance Criteria

The MVP is complete when:

- [ ] Today's log can be completed in under 2 minutes.
- [ ] Previous days can be edited.
- [ ] Dashboard updates after saving.
- [ ] Dashboard supports at least 7-day and 30-day views.
- [ ] Weekly summary is derived from raw daily data.
- [ ] Habits show completion history and streaks.
- [ ] Goals show measurable progress.
- [ ] All personal records are authorization-protected.
- [ ] App works on mobile and desktop.
- [ ] Migrations and seed data are reproducible.
- [ ] Critical business logic has automated tests.
- [ ] A clean environment can deploy the application using documented steps.

---

## 23. Suggested Project Structure

```text
src/
  app/
    (auth)/
    (dashboard)/
      page.tsx
      daily/
      habits/
      goals/
      projects/
      learning/
      analytics/
      reviews/
      settings/
    api/

  components/
    ui/
    dashboard/
    daily/
    habits/
    goals/
    charts/

  features/
    daily/
    habits/
    goals/
    projects/
    learning/
    analytics/
    reviews/

  lib/
    db/
    auth/
    validation/
    dates/
    analytics/

  server/
    services/
    repositories/
    queries/

  types/

prisma/ or drizzle/

tests/
```

---

## 24. Important Engineering Decisions

### 24.1 Do not over-engineer

Do not introduce:

- Redis
- Kafka
- Elasticsearch
- ClickHouse
- Microservices

unless a real requirement appears.

### 24.2 PostgreSQL is the source of truth

All personal data should initially live in PostgreSQL.

### 24.3 Next.js fullstack is intentional

Do not create a separate Go backend merely because the developer is a backend engineer.

Use Next.js fullstack first.

### 24.4 Analytics before caching

Benchmark analytics queries first.

Only introduce caching after identifying an actual performance problem.

### 24.5 Background jobs

Introduce a worker only when there is genuinely asynchronous work, such as:

- Scheduled weekly review.
- AI analysis.
- Notifications.
- Large data processing.

---

## 25. Future Scalability Path

### Phase 1

```text
Next.js + PostgreSQL
```

### Phase 2

Add worker for:

- Scheduled jobs.
- AI analysis.
- Notifications.

### Phase 3

Add Redis only for demonstrated needs:

- Caching.
- Rate limiting.
- Temporary state.

### Phase 4

Add object storage for:

- Images.
- Documents.
- Attachments.

### Phase 5

Add specialized search/analytics infrastructure only if PostgreSQL becomes insufficient.

The target is **modular complexity**, not maximum infrastructure.

---

## 26. Product Philosophy

The application should:

- Reduce friction rather than create another productivity obligation.
- Make logging easier than using a spreadsheet.
- Turn analytics into decisions rather than decorative charts.
- Keep historical data exportable.
- Allow the user to continue after missing a day.
- Let new modules be added independently.

---

## 27. First Build Order

1. Initialize Next.js + TypeScript.
2. Add PostgreSQL + ORM + migrations.
3. Create responsive application shell.
4. Implement authentication/ownership.
5. Implement `daily_logs` schema.
6. Build mobile-first daily logging page.
7. Build daily history page.
8. Build dashboard summary.
9. Add 7/30-day charts.
10. Add habits.
11. Add goals.
12. Add weekly review.
13. Add tests and seed data.
14. Deploy.
15. Use the application yourself for 30 days before adding major features.

---

## 28. Post-MVP Backlog

- Custom metrics.
- Drag-and-drop dashboard widgets.
- Calendar heatmap.
- Advanced filtering.
- CSV/JSON export.
- Backup/restore.
- Recurring goals.
- Habit templates.
- Time tracking.
- Finance module.
- Knowledge base.
- Personal CRM.
- AI weekly review.
- AI anomaly detection.
- Natural-language queries over personal data.

---

## Final Engineering Principle

> **Start as a modular monolith, keep PostgreSQL as the source of truth, and let real usage determine where complexity is justified.**