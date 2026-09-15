# Features

A personal life-tracking app: one daily log, and everything else built from
it. Nothing is required — the daily loop works on its own, and every other
module is there when it earns its place.

## The shape of it

Two ideas explain most of the design.

**The daily log records the past. Plans live elsewhere.** `daily_logs` never
holds intent; that is what the Calendar's day view, planned blocks and tasks
are for.
Mixing them would mean "what I meant to do" and "what I did" could never be
compared.

**A fact is entered once.** A timed session becomes the day's study minutes.
A habit bound to a metric ticks itself. A project's time spent is the sum of
sessions attributed to it. Nothing asks twice.

---

## Daily log — `/daily`

The spine. One entry per day, editable for any past day.

**How to use it.** Open Daily Log, fill what you care about, press Save — or
`S` from anywhere outside a text field. Four fields carry most of the value:
energy, sleep, study time and deep work. The rest is optional.

- `[` and `]` move a day back and forward, `T` returns to today
- **Copy yesterday** fills the form from the previous entry; copied fields
  stay highlighted until you touch them
- The dashboard offers a **two-tap quick log** (energy and sleep) when today
  is still blank
- **Catch-up** (`/daily/catch-up`) fills several missed days in one grid

Blank means *not recorded* — never zero. A skipped day does not drag an
average down.

### Your own activities

The built-in fields are not the ceiling.

**Settings → Your own activities → New activity.** Give it a name in both
languages; the key fills itself from the English name and stays editable. Pick
a kind — number, scale 1–10, yes/no, or text — and a unit if it helps.

It then appears on the daily log under **Your own**, and **a habit or a goal
can bind to it exactly like a built-in metric**. Removing one hides it from
the form; the days already logged keep their values.

---

## The day — `/calendar` (Day)

What you are doing, and what you meant to do. The Calendar opens here.

**How to use it.** Type a task in the box on the **To do** card and press Add —
no project needed. It is due the day you are looking at, so you never pick a
date. Click the circle to tick it off. The day also gathers time blocked out,
reminders that have come due, and the priority you wrote on yesterday's log.

**Planning tomorrow.** Press **Plan tomorrow**. The date moves and anything you
add is due that day. The `‹ ›` arrows reach any day; **Back to today** returns.
The other views share the same date, so switching to Week keeps the day you
were on.

What shows on a given day:

| Task | Shown? |
| --- | --- |
| Due that day | yes, on **To do** |
| Overdue | yes, on **To do**, marked **Overdue** |
| Due later | no |
| No due date | not on **To do** — on **Not on a day yet** |

**Not on a day yet** is the backlog: tasks nobody has given a date. It is a
separate card on purpose — a task with no date is not part of today's plan, and
repeating it on every day makes each day look busier than it is. The calendar
icon beside a backlog task puts it on the day being viewed, which moves it up
to **To do**.

---

## Habits — `/habits`

**How to use it.** Create a habit, choose how often (daily, weekly, certain
weekdays, or every N days), and tick it as you go.

**Or do not tick it.** Bind the habit to a metric — "sleep ≥ 7h", "study ≥ 60
min" — and it completes itself from the daily log. Custom metrics work here
too. A derived tick disappears if the underlying number changes, so the two
can never disagree.

Streaks survive one missed day when grace is on.

---

## Goals — `/goals`

Longer arcs, in one of three shapes:

- **Manual** — you set the percentage
- **Metric** — "300 study minutes a week". Pick the metric, how to total it
  (sum, average, days done, latest), the window, the target, and whether the
  target is a floor or a ceiling. Progress then keeps itself
- **Milestones** — weighted steps; heavier ones move the bar further

A project can be attached to a goal, which is how work connects to intent.

---

## Projects — `/projects`

Projects hold tasks; tasks hold sub-tasks, one level deep.

**How to use it.** Add a task with the box at the top of a project, optionally
with a due date. Time spent is **never typed** — it is the sum of focus
sessions attributed to the project, so it cannot drift from reality.

---

## Timer — `/timer`

**How to use it.** Choose focus or workout, stopwatch or countdown, say what
it is for, press Start — or `Space`. The badge in the header follows you
around the app, and the tab title carries the clock so another tab still shows
the run.

On finishing, a focus run becomes a `focus_session` and lands in the day's
study or deep-work minutes; a workout run becomes a workout. Runs under the
minimum are discarded rather than recorded. The screen is kept awake while a
run is going.

---

## Calendar — `/calendar`

Day, week, month and year views over the same data. Day is described above;
the rest are the grids.

**Events** are things that happen at a time. **Blocks** are time set aside for
a kind of work, optionally pointed at a project or task — this is the
forward-looking half the daily log deliberately lacks.

Repeating events expand for daily, weekly, monthly, quarterly and yearly
rules, and refuse to slide a date into a month that lacks it: a 31st skips
short months, and 29 February returns only in leap years.

`/api/calendar.ics` exports one-way, so the data stays readable in any
calendar app.

---

## Learning and knowledge

**Learning** (`/learning`) tracks topics, resources (books, courses, videos)
with status and progress, and sessions.

**Knowledge** (`/knowledge`) holds notes in Markdown. `[[Wiki links]]` connect
them, and a link to a note that does not exist yet is kept rather than
dropped — an unwritten note is a note worth writing. Backlinks are shown on
each note.

**Lessons.** A note typed as a *lesson* carries the day it was learned, not
the day it was typed, and its **place** is a tag — `#office`, `#home`. The
review page then groups the period's lessons by tag, so "what did I learn at
work" and "what did I learn about Postgres" are both answerable. A lesson
under two tags appears under both.

---

## Reviews — `/reviews`

Weekly, monthly and yearly, each with the period's numbers computed for you
and five things to write: what worked, what did not, what to change, the top
priority, and a free reflection.

**How to use it.** Open the period, read the numbers, and use **seed** to pull
your own daily wins and problems into the text rather than remembering them.
Finalising freezes the numbers, so the review still shows what it showed then;
a draft recomputes every time you open it.

With an API key configured, an AI narrative can be generated for a week or a
month. Only aggregate numbers and rule-generated observations are sent — no
notes, no journal entries, no names — and the result is always labelled.

---

## Finance — `/finance`

Accounts, categories, transactions, budgets, assets and investments.

**How to use it.** Add an account first — transactions need somewhere to sit.
Then log income, expense or transfer. A transfer moves money between your own
accounts and counts as neither income nor expense.

Amounts format as you type: `100000` becomes `100.000`. Budgets are a monthly
limit per category; click a budget's name to change the amount. Investment
prices are typed by hand — the app fetches no market data.

**Quick capture** can read a sentence like *"banh mi 30k this morning, coffee
25k, lunch 55k"* and propose the transactions; nothing is saved until you
confirm.

---

## Health — `/health`

Workouts with sets, body measurements, and nutrition. Exercise minutes flow
into the daily log.

---

## People — `/people`

A personal CRM. Record who matters, how often you mean to be in touch, and
what you last talked about — the point is being told when it has been too
long.

**Photos.** With Cloudinary configured, each person has a gallery: upload
straight from the browser, click a thumbnail for the full-size image. The grid
pulls small, cheap images and the full view pulls a good one, from one stored
original.

---

## Analytics, dashboard and search

**Dashboard** (`/`) is today at a glance: the day's numbers against yesterday,
a score you can open to see how it was calculated, streaks, and trends once
enough days exist.

**Analytics** (`/analytics`) shows trends and comparisons — energy on
seven-hour nights versus shorter ones. Nothing appears until there is enough
data to mean anything, and everything is stated as an association, never a
cause. A test enforces that wording in both languages.

---

## Getting around

**Command palette** — `⌘K`. It is also the search: two characters or more and
it looks through notes, journal entries, daily logs, tasks, projects, goals
and people in one accent-insensitive query, each result carrying the icon of
what it is. The same box jumps to any page, logs a metric without leaving the
screen (`sleep 7.5`, `study 45`, `energy 8`), and opens a bare date like
`2026-09-01`.

**Quick capture** — `⌘J`, from anywhere.

**Keyboard shortcuts** — press `?`, or use the button beside the capture
launcher, or open it from Settings. **Every shortcut is editable**: click a
key, press the new one. Two-key sequences work (`g` then `d`), conflicts are
refused, and the changes follow you to another device.

Escape, the arrows, Enter and the digits stay fixed — they are controls, not
preferences, and a bare digit would swallow the 1–10 scores on the daily log.

---

## Settings

Language, theme and density; timezone and the hour a day rolls over; what the
score weighs; your own activities; keyboard shortcuts.

**Your data** exports as JSON (everything) or CSV (one module), and imports
back with a dry run that reports what would be created before anything is
written.

---

## Signing in

Either the credential pair from the environment, or Google. Who may sign in is
controlled by `AUTH_OWNER_EMAIL`, `AUTH_ALLOWED_EMAILS`, `AUTH_ALLOWED_DOMAINS`
and `AUTH_ALLOW_SIGNUP`.

The default is **closed**. Empty lists with signup off means only the owner
gets in — this app holds a journal, health records and finances, and leaving
registration open because the URL happens to be public is not a default worth
shipping.

Note that an empty allowlist does not mean "allow everyone": with no lists at
all, `AUTH_ALLOW_SIGNUP=true` is what opens the door. Add a list and that
switch changes meaning — it then only lets people *on the list* create a
workspace.

---

## Optional services

Everything below is off unless configured, and the UI hides rather than breaks.

| Service | Variables | Without it |
| --- | --- | --- |
| Google sign-in | `NEXT_PUBLIC_FIREBASE_*` | The Google button does not appear |
| AI narrative | `ANTHROPIC_API_KEY` | Reviews offer no narrative |
| Quick capture | Gemini key | Capture launcher hidden |
| Photos | `CLOUDINARY_*` | Photo UI hidden |
