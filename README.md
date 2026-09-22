# Personal OS

A personal operating system for tracking daily performance, understanding your own
behaviour, and managing goals, habits and the rest of personal life management.

Built to the specification in [requirement.md](requirement.md) — that document is the
authority on product decisions; this one is how to run the thing.

> **Data first, dashboard second. Logging must be faster than opening a spreadsheet.**

---

## Sign-in

Two doors into the same app: **Google** (via Firebase) and an **env credential
pair**. Both mint the same signed, httpOnly session cookie, and `AUTH_SECRET`
signs it either way.

```bash
AUTH_USERNAME=me
AUTH_PASSWORD=something-long
AUTH_SECRET=$(openssl rand -hex 32)   # signs the session cookie
```

Middleware checks the cookie on every route, so no page, action or API handler
can forget the check. Sign-in attempts are rate limited per process (8 per 15
minutes for credentials, 20 for Google).

### What each request actually verifies

A Firebase ID token is verified **once**, at sign-in, by
[`/api/auth/google`](src/app/api/auth/google/route.ts) — signature checked
against Google's public keys with `jose`, then traded for our own cookie and
discarded. Every request after that verifies only the HMAC cookie: no network
call, no database read, and nothing that stops `proxy.ts` running at the edge.

The trade is that revocation is not instant. Disabling an account in the
Firebase console does not kill a cookie already issued; it expires on its own
after 30 days. To cut someone off now, delete their `users` row — the session
then names a user that no longer exists and every request fails closed.

### Who is allowed in

The default is **closed**: with no lists configured, only the owner can sign
in, and an unknown Google account is refused rather than handed a new
workspace.

| Variable | Effect |
|---|---|
| `AUTH_OWNER_EMAIL` | this address links to the pre-existing owner row instead of creating a new one |
| `AUTH_ALLOWED_EMAILS` | comma-separated addresses that may sign in |
| `AUTH_ALLOWED_DOMAINS` | comma-separated domains that may sign in |
| `AUTH_ALLOW_SIGNUP` | `true` lets any permitted address create its own workspace |
| `NEXT_PUBLIC_FIREBASE_API_KEY`<br>`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`<br>`NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase web config. Not secrets — they identify the project, they authorise nothing. Absent, the Google button simply does not render. The client uses the **page host** as `authDomain` (with `/__/auth` proxied in `next.config`), which keeps Firebase's sign-in helper same-origin and puts your own domain on Google's consent screen; add `https://<your-app>/__/auth/handler` to the Google OAuth client's authorized redirect URIs. |

Set `AUTH_OWNER_EMAIL` to your own Google address before first sign-in.
Otherwise your Google account is a stranger to the database and gets an empty
workspace beside the one holding all your data.

**Multi-user, but not a user system.** Each account gets its own workspace and
every query is filtered by `user_id`, but there is no password reset, no
invitations, no roles, and the in-process rate limiter resets on restart. For
anything beyond personal use, put it behind a private network (Tailscale,
WireGuard) as well.

> Upgrading from the single-user build? Session cookies issued before this
> change name a username rather than a user row, so they are rejected and you
> sign in once more. Nothing else changes: your data stays on the owner row.

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
| `AI_SERVICE_URL` / `AI_SERVICE_TOKEN` | optional — `medaily-ai`, which answers quick capture, the review chat, the AI review and the assistant |
| `NEXT_PUBLIC_FIREBASE_*`, `AUTH_OWNER_EMAIL` | optional — only to enable Google sign-in (see [Sign-in](#sign-in)) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | optional — send crashes to a Telegram chat (see [Crash alerts](#crash-alerts)) |

Migrations do not run on build, by design. Run them from your machine against
the same database whenever the schema changes:

```bash
DATABASE_URL="<the same connection string>" pnpm db:migrate
```

**Check you are migrating the database the deploy actually uses.** The command
prints a fingerprint of the host and database name; `/api/health` prints the
same one for the deploy. Equal means the same database:

```bash
pnpm db:migrate                  # → … (fingerprint 312dffd3)
curl -s https://<your-app>/api/health | grep databaseFingerprint
```

Getting this wrong is quiet and expensive: the migration reports success, the
push deploys, and the pages that need the new column go down while the
fingerprints sit there disagreeing. `pendingMigrations` on the deploy's health
endpoint is the other half of the same answer.

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
| `pnpm capture:check` | Runs real notes the whole way round — this app, `medaily-ai`, the model — and checks what comes back (needs `AI_SERVICE_*`) |
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
  only, off unless `medaily-ai` is configured.
- **Quick capture** *(opt-in)* — a box in the bottom-right corner of every
  page. Type a day's spending as one sentence ("sáng ăn phở 40k, cà phê 25k,
  đổ xăng 100 nghìn") and get one editable draft row per payment. Off unless
  `AI_SERVICE_URL` and `AI_SERVICE_TOKEN` are set. See below.

## Quick capture

With `medaily-ai` configured, a launcher appears in the bottom-right corner of
every page (**⌘/Ctrl + J** to open or close, **Esc** to close). The finance page
carries the same box inline, above the transaction form.

Type `/` to choose where the note goes, then write it the way you'd say it.

### Finance

```text
sáng ăn bánh mì 30k, cà phê 25k, trưa cơm gà 55k, hôm qua đổ xăng 100 nghìn
```

**Xem trước** (⌘/Ctrl + Enter) turns that into four editable rows — merchant,
amount, kind, category, date — with a running total. Nothing is written until
you press save.

### Review

`/tổng kết` opens a conversation about a week or a month. Tap **Tuần này**,
**Tuần trước** or **Tháng này**, or type the period yourself — "tháng trước",
"tháng 7", "tuần rồi" all resolve, accents optional. The period is worked out
by [a regex](src/lib/reviews/period-phrase.ts), not by the model: a date range
is arithmetic, and asking a model for one costs a round trip to be less
reliable.

You get the period's numbers read back against the one before it, with your own
"làm được gì / vướng ở đâu" lines quoted where they matter. It offers **no
advice** until you ask for it — an unrequested lecture attached to every number
is what makes a tracker unpleasant to open. Ask, and you get at most three
suggestions, each tied to a number or a line you wrote.

What is sent: that period's aggregates and the lines you wrote in the daily
log. Your journal, your notes and other people's names stay on the machine.
The reply language follows `user_settings.locale`, not the cookie — the
language switcher sets both.

The transcript belongs to the open panel and is replayed to the model from
there; each exchange is also written to `ai_reports` as an archive. Deliberately
not the other way round: a thread keyed only by the period would resume a
month-old conversation every time you asked about that week again.

### What a message is asking for

Every message is classified before anything is sent, by
[`classify`](src/lib/reviews/intent.ts) — a handful of phrases, no model call,
because a model would cost a round trip and a second chance to be wrong to
settle what a regex already settles.

`translate` matters most: "dịch sang tiếng Anh" rewrites the answer already on
screen. Routed as an ordinary question it would rebuild the period and return a
*different* review in another language — measured, 13.4s and a full context
payload against 6.5s and no database work. `suggest` lifts the no-advice rule,
`open` asks for a full review, and anything unrecognised is a plain follow-up,
which is the safe default.

The routing is a regex here rather than a graph because these four branches
have no cycles. Where a conversation does need one — the assistant, which
remembers a thread across turns — that is LangGraph's job, and it runs in
`medaily-ai` along with the model call it wraps.

### Adding a destination

The menu is a registry in
[`src/lib/capture/modules.ts`](src/lib/capture/modules.ts): a new one is one
entry there plus a branch in the box's dispatch.

### What actually leaves the machine

The sentence you typed, today's date, your currency code, and the *names* of
your own categories. No balances, no transaction history, no other module. The
request sets `store: false`, so the interaction is not retained after it is
answered.

### How the model's output is treated

It never reaches the database directly:

- Amounts are rounded to whole cents and anything ≤ 0 drops the row.
- Dates are clamped into the last 365 days, never the future.
- A category is only attached when it matches one you already created — the
  match is accent-insensitive, so "an uong" finds "Ăn uống" — otherwise the row
  saves with no category.
- The save action re-checks every account and category id against your own rows,
  so a well-formed id you don't own is rejected.
- Transfers are out of scope: they need a second account no sentence names.
  Everything comes back as income or expense, and you can switch a row over in
  the manual form.

Capped at 25 rows per note and 10 notes per minute.

### Where the model calls happen

Not here. Every prompt in the product lives in
[`medaily-ai`](https://github.com/nhankhtn/medaily-ai), a second deploy that
owns the key, the fallback chain between models and the quota that comes out of
it. This app sends what it knows about the person and renders what comes back:
which categories exist, what a draft row is allowed to be, and the check that
turns an answer off a model into rows a form can show — those stay here.

| what | route on `medaily-ai` |
| --- | --- |
| quick capture, finance | `POST /api/capture/finance` |
| quick capture, goals and to-dos | `POST /api/capture/plan` |
| the review chat | `POST /api/review/ask`, `POST /api/review/translate` |
| the written AI review | `POST /api/report/narrative` |
| the assistant | `POST /api/chat/live`, `DELETE /api/threads/:id` |

`AI_SERVICE_TOKEN` is a shared secret between the two deploys and never reaches
a browser: the calls go out from Server Actions, and the assistant's stream
from a route handler at `/api/assistant` that pipes it through.

`pnpm capture:check` runs a set of real Vietnamese and English notes through
that whole path and prints what came back, so a prompt change over there can be
judged from here rather than guessed at:

```bash
pnpm capture:check              # every case
pnpm capture:check xăng 7       # only cases matching "xăng", plus case 7
pnpm capture:check --gap=0      # no pacing (for a paid key)
```

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
`⌘J` quick capture · `g` then `d/h/g/a/s/o` to navigate · `[` / `]`
previous/next day · `t` today · `1`–`0` set the focused 1–10 metric · `s` save ·
`Esc` closes any layer.

The full list is on the settings page, so it is findable without the README:
[`src/features/settings/shortcuts-panel.tsx`](src/features/settings/shortcuts-panel.tsx).
Adding a key means adding a row there.

## License

Private personal project.

## Crash alerts

Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` and every server error Next
catches — a render, a route handler, a server action, the proxy — arrives as a
message, along with anything the browser's error boundary catches. Without both
variables nothing is sent and errors go to the console exactly as before.

```
⚠️ medaily (production)
render · GET /calendar

Cannot read properties of null (reading 'id')
req 3f9a1c07  ·  digest 2894013755

at CalendarPage (.next/server/app/(app)/calendar/page.js:1:4021)
```

To set it up: make a bot with [@BotFather](https://t.me/botfather), send it any
message, then read your chat id from
`https://api.telegram.org/bot<token>/getUpdates`.

**Set these on the deploy, not in `.env.local`** — otherwise every typo on your
own machine buzzes your phone.

### Request ids

Every request is stamped with a short id by the proxy, and it travels three
ways at once so one failure can be found from any of them:

| Where | Looks like |
|---|---|
| Server console | `[finance] [req 3f9a1c07] could not parse the note: …` |
| Telegram alert | `req 3f9a1c07 · digest 2894013755` |
| Response header | `x-request-id: 3f9a1c07`, readable in devtools |

An id the request already carries is kept rather than replaced, and Vercel's
own `x-vercel-id` is adopted when there is one, so a trace does not split in
two between their logs and ours.

One thing to know about the browser: a server action is its own request with
its own id. `useRequestId()` gives a client component the id of the **page
load**, which is what a browser-side error belongs to — for a failed action,
the id to quote is the one in the server's log line and in its alert.

Two things the sender does that are worth knowing:

- **Credentials are stripped before anything is sent.** A bad `DATABASE_URL`
  makes Next throw `Invalid URL` with the whole connection string, password
  and all, inside `error.message`. Passwords in URLs, anything named like a
  token or a key, `Bearer` values, and bare strings long enough to be a secret
  are all replaced first. Request headers are never read at all, since they
  carry the session cookie.
- **A failing route cannot flood the chat.** The same failure on the same route
  is sent at most once every five minutes, and no more than twenty messages go
  out in an hour. The counter is per server instance, so treat it as a limit on
  the flood rather than an exact count.
