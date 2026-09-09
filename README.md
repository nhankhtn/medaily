# Personal OS

A personal operating system for tracking daily performance, understanding your own
behaviour, and managing goals, habits and the rest of personal life management.

Built to the specification in [requirement.md](requirement.md) — that document is the
authority on product decisions; this one is how to run the thing.

> **Data first, dashboard second. Logging must be faster than opening a spreadsheet.**

---

## Sign-in

One account, credentials in the environment. Set all three or the app refuses
every request except `/api/health` — a misconfigured deploy is closed, not open.

```bash
AUTH_USERNAME=me
AUTH_PASSWORD=something-long
AUTH_SECRET=$(openssl rand -hex 32)   # signs the session cookie
```

Middleware checks a signed, httpOnly session cookie on every route, so no page,
action or API handler can forget the check. Sign-in attempts are rate limited
per process (8 per 15 minutes).

**This is a single-user gate, not a user system.** It is enough to put the app
on a private URL; it is not multi-tenant, there is no password reset, and the
in-process rate limiter resets on restart. For anything beyond personal use, put
it behind a private network (Tailscale, WireGuard) as well.

---

## Requirements

- Node 22+ and pnpm 10+
- PostgreSQL 16+ (local, Docker, or a managed provider such as Neon/Supabase)

## Quick start (local Postgres)

```bash
cp .env.example .env.local          # then set DATABASE_URL
pnpm install
pnpm db:migrate                     # applies migrations, views, triggers, owner row
pnpm db:seed                        # optional: 90 days of realistic demo data
pnpm dev                            # http://localhost:3000
```

`DATABASE_URL` examples:

```bash
# local, TCP
DATABASE_URL=postgres://user:password@localhost:5432/medaily
# managed (Neon/Supabase — use the pooled connection string)
DATABASE_URL=postgresql://user:password@host/db?sslmode=require
```

## Quick start (Docker Compose — the primary target)

```bash
export POSTGRES_PASSWORD=$(openssl rand -hex 16)
docker compose up -d --build

# Migrations run explicitly, from the host, against the compose database:
DATABASE_URL="postgres://personal_os:$POSTGRES_PASSWORD@localhost:5432/personal_os" \
  pnpm db:migrate   # temporarily publish the db port, or run inside the network
open http://127.0.0.1:3000
```

The app binds to `127.0.0.1` and the Postgres port is never published. See the
authentication warning above before changing either.

## Deploying to Vercel

Set these in the project's environment variables — the app refuses every request
except `/api/health` until all four are present:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the managed Postgres connection string (use the **pooled** one) |
| `AUTH_USERNAME` | your login |
| `AUTH_PASSWORD` | a long password |
| `AUTH_SECRET` | `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | optional — only to enable the AI review |

Migrations do not run on build, by design. Run them from your machine against
the same database whenever the schema changes:

```bash
DATABASE_URL="<the same connection string>" pnpm db:migrate
```

**Use `pnpm db:migrate`, not `drizzle-kit push`.** `push` creates the tables and
nothing else — no views, no triggers, no `unaccent`, no owner row — and the app
then fails on every page that reads settings. If a database is already in that
state, fix it without losing data:

```bash
pnpm db:baseline   # records the existing migrations so migrate stays incremental
pnpm db:migrate    # applies views, triggers and the owner row
```

### When something is wrong

`GET /api/health` is the first place to look. It names missing environment
variables and the actual driver error, and never echoes a value:

```json
{ "status": "error", "database": "unreachable",
  "reason": "connect ECONNREFUSED …",
  "missingEnv": ["AUTH_SECRET"], "authConfigured": false }
```

The sign-in page and the app shell fall back to defaults when the database is
unreachable, so you get a usable page and a real diagnosis instead of a
minified Server Components error.

> **Do not set `output: 'standalone'` unconditionally.** Vercel does its own
> output tracing and then reads `.next/next-server.js.nft.json`, which
> standalone mode does not leave in `.next` — the build compiles and then fails
> with `ENOENT`. [next.config.ts](next.config.ts) keeps standalone for Docker
> and switches it off when `VERCEL` is set.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production build and run |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit + integration tests (Vitest) |
| `pnpm test:unit` | Pure domain logic only — no database needed |
| `pnpm test:integration` | Constraints, transactions and views against a real Postgres |
| `pnpm smoke` | Signs a session and requests every route in both locales |
| `pnpm db:generate` | Generate a migration from schema changes |
| `pnpm db:migrate` | Apply migrations, then re-apply views/triggers (idempotent) |
| `pnpm db:baseline` | Mark existing migrations as applied — for a database created with `drizzle-kit push` |
| `pnpm db:seed` | Seed 90 days of sample data (`SEED_DAYS=365` to change). Refuses on a database that already has data — use `pnpm db:reset`, or `pnpm db:seed -- --force` |
| `pnpm db:reset` | Drop schema → migrate → seed (refuses in production) |
| `scripts/backup.sh` | `pg_dump` to `./backups`, with retention |
| `scripts/restore.sh <dump>` | Restore into `TARGET_DATABASE_URL` |

## What is built

**Core loop:**

- **Daily log** — progressive form, 10-segment tap bars, minute presets, half-hour
  sleep stepper, copy-yesterday, 14-day median ghosts, local draft autosave, undo,
  swipe/keyboard day navigation, catch-up grid for missed days, edit any past day.
- **Dashboard** — today's tiles with deltas, transparent day/week score, streaks,
  insight cards, four trend facets, goal pace, today's habits.
- **Habits** — daily / weekly / specific-days / interval, metric-linked habits that
  complete themselves from the daily log, 28-day grid, streaks with a grace day.
- **Goals** — manual, metric-driven and milestone-driven progress, pace indicator.
- **Analytics** — 7/30/90/365-day trends with 7-day moving averages, bucket
  comparisons with sample-size gates, time allocation.
- **Settings** — locale, theme, timezone, day rollover hour, week start, streak
  grace, editable score weights.
- **Everything bilingual** (EN/VI), switchable instantly, no URL prefix.

- **Projects** — projects with tasks, inline add, and time spent summed from focus
  sessions rather than typed in.
- **Learning** — server-side timer that survives refresh, focus sessions, topics,
  time-by-topic, books and courses.
- **Reviews** — weekly, monthly and yearly; live numbers while a draft, frozen
  snapshot on finalize, written fields pre-seeded from your own daily wins.
- **Health** — workouts with sets, body measurements with a 7-day average, and
  lightweight nutrition. A workout back-fills the day's exercise minutes.
- **Finance** — accounts with derived balances, categories, transactions and
  transfers, budgets, assets, liabilities, manually-priced investments, net worth.
- **Journal & Knowledge** — Markdown with preview, tags, `[[wiki links]]` and
  backlinks.
- **Calendar** — events, planned time blocks, plan-vs-actual against real focus
  sessions, and `.ics` export.
- **People** — a personal CRM that tells you who is overdue, upcoming birthdays,
  interactions and reminders.
- **Career** — skills with current/target level, achievements, portfolio.
- **Search** — one query across notes, journal, daily text, tasks, projects,
  goals and people, accent-insensitive.
- **Import/export** — full JSON round-trip with a dry run, plus CSV.
- **AI review** *(opt-in)* — a narrative for a period, grounded in aggregates
  only, off unless `ANTHROPIC_API_KEY` is set.

## Architecture in one screen

```text
src/app/                routes (RSC) + Server Actions
src/features/<module>/  UI and client logic per module
src/server/services/    domain logic, transactions
src/server/repositories/ every SQL statement, always filtered by user_id
src/lib/                pure logic: dates, scoring, streaks, habits, goals, analytics
src/lib/db/schema/      Drizzle schema, one file per module
drizzle/                generated migrations + idempotent views.sql
messages/               en.json / vi.json (CI fails on a missing key)
tests/unit|integration  Vitest
```

Rules that are enforced, not just documented:

- No business logic in components; no SQL outside repositories.
- Every input validated with Zod at the boundary.
- `v_daily_effective` is the single read path for analytics, scoring, streaks and
  reviews — it resolves manual minutes against focus sessions.
- `NULL` is not zero. Not logging a metric never averages as a zero.
- Scores, streaks, goal progress and review numbers are **derived**, never stored.
- No Redis, Kafka, Elasticsearch, ClickHouse or microservices.

## Notable defaults (all changeable in Settings)

| Behaviour | Default |
|---|---|
| Day rollover hour | 04:00 — a 01:30 entry belongs to the previous day |
| Week starts | Monday (ISO-8601) |
| Streak grace | On — one miss per rolling 7 days pauses a streak, two in a row break it |
| Score weights | focus 30 · sleep 20 · exercise 15 · habits 15 · reading 10 · entertainment 10 |
| Rest-day credit | On — a zero-exercise day still scores 0.7 after 4 active days in a week |
| Week score coverage floor | 4 logged days, else the number is withheld |
| Correlation gates | ≥ 21 paired days, ≥ 7 per bucket, effect ≥ 5% of the metric's range |

## Keyboard

`⌘K` command palette (jump, or type `sleep 7.5`, `study 45`, `2026-09-01`) ·
`g` then `d/h/g/a/s/o` to navigate · `[` / `]` previous/next day · `t` today ·
`1`–`0` set the focused 1–10 metric · `s` save · `Esc` closes any layer.

## License

Private personal project.
