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

### With no signal

The daily log is the one screen that works offline, because it is the one you
reach for in a lift or on a metro.

Open the app once with a connection and it keeps a copy of the page. After
that, opening `/daily` with no network shows the form instead of a browser
error. Fill it, press Save, and it is kept on the device — the toast says so
rather than claiming it was saved. It goes up on its own the next time the app
has a connection, on whatever screen you happen to be on, and a second toast
says how many days went.

Two things worth knowing. Sending the same day twice is harmless: the write
replaces the row for that date rather than adding one, which is what made the
daily log the safe place to start. And only the daily log does this — every
other screen still needs a connection, and a day held on the device is dropped
from the queue if the server ever refuses it outright, so a bad entry cannot
block the good ones behind it.

Signing out clears both the cached page and anything still waiting to be sent.
Both are your own day: the page as rendered data, the queue as a save that has
not gone up yet. Neither should be there for whoever signs in next — an unsent
day would otherwise land in their account. So sign out on a device with days
still waiting and those days are gone; get a connection first.

### Your own activities

The built-in fields are not the ceiling.

**Settings → Your own activities → New activity.** Give it a name in both
languages; the key fills itself from the English name and stays editable. Pick
a kind — number, minutes, scale 1–10, yes/no, or text — and a unit if it helps.
**Minutes** is the one that earns more than an input box: the timer offers it
alongside the built-in activities, so an activity you invented can be timed
like any other.

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

The list is yours to arrange: drag a card by the handle on its left, or focus
the handle and use the arrow keys. The order is saved and follows you to
another device. Completed goals still sink below active ones — status comes
first, and the arrangement applies within it.

A project can be attached to a goal, which is how work connects to intent.

Goals can also arrive from quick capture: describe what you want in a
sentence and the draft lands in the goal form for you to check. A metric it
invented, or a deadline in the wrong century, is dropped before the form ever
sees it.

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
study or deep-work minutes; a workout run becomes a workout; one of your own
minute-measured activities is added onto that day's value for it. Runs under the
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

**Topics** are the areas you put hours into — Postgres, English, system
design. **Manage** on the *Time by topic* card opens them: add one, rename it,
or put it away. Pick a topic when you start a timed run and the chart fills
itself; putting one away hides it from the pickers and leaves the sessions
already filed under it alone.

**Knowledge** (`/knowledge`) holds notes in Markdown.

**Wiki links.** Write `[[Title of another note]]` in the body. On save the
link is recorded, matching the title whatever the casing. Click a note's title
to open it: the body renders resolved links as real links, and **Linked from**
at the bottom lists every note pointing here — which is where the payoff shows
up, on the note being pointed at rather than the one you typed in.

A link to a note that does not exist yet is kept rather than dropped — an
unwritten note is a note worth writing. It reads as bold brackets until then,
and starts linking on its own the day you create that note.

**Filing a note.** A note can be put under a **topic** and against a **book or
course**, both optional and both chosen from what Learning already knows — the
same topics the timer offers. The card then shows what it is filed under. Put
a topic away and notes filed under it keep the link but stop showing the name,
exactly as a focus session does.

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

**Debts.** A transaction can name someone from your contacts, and that is what
makes it a debt. Which way it counts follows from the transaction itself: money
going out is you lending or paying someone back, money coming in is them paying
you back or you borrowing. Those add up to one number per person — above zero
they owe you, below zero you owe them — shown in a card on this tab. Nothing is
ever marked "settled": settling a debt *is* recording the repayment, so a debt
cannot go stale behind a tick box someone forgot.

Money you lend is not money you spent, so debts are left out of the income and
expense totals and out of the report. Your account balance still drops, because
the money really did leave; your net worth does not, because you are owed it.
A transfer moves money between two accounts you already own, so it cannot be a
debt and the field is not offered.

**Two tabs.** *Overview* is the ledger above. *Report* is what the numbers add
up to.

Pick the stretch with the two selects at the top: a year, and a month within it
or *Whole year*. The choice lives in the address (`/finance?tab=report&period=2026-09`,
or `&period=2026`), so a period can be linked to and the back button walks back
through the ones you looked at. A month is drawn with the five months before it
for context; a whole year is drawn as its twelve months.

Spending by category is a ring, biggest slice first, with the total in the hole
and a ranking beside it in the same colours — the dot on each row is its slice.
Past eight categories the tail is folded into one *Other* slice, because a pie
of twenty slivers answers nothing. Spending with no category at all and the
folded *Other* are different rows and say so.

A month is compared against what a normal month costs, counting only months
that have something recorded. The chosen month is left out of its own average,
and so is the month now running, since it is not over yet; a month from before
you started recording is not a month you spent nothing in. A whole year is
compared against the year before instead, because a year has no monthly average
of its own to be held up against. With nothing to compare against, the report
says so rather than showing a figure.

"Kept" is the share of income left over. With no income recorded there is no
share to give, so it shows `—` rather than 0%, which would read as breaking
even. A period with nothing in it says so and leaves the selects in place,
since picking another one is the way out.

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

**Quick capture** — `⌘J`, from anywhere. Type `/` and the box lists where a
note can go; you pick, rather than it guessing, so a note that reads like two
things cannot land in the wrong one.

| `/` | What it reads |
| --- | --- |
| **Goals & to-dos** | A paragraph of intentions, split into goals to pursue and tasks to tick off |
| **Finance** | A day's spending from one sentence — *"banh mi 30k, coffee 25k"* |
| **Reviews** | A question about how a week or a month went |

**Nothing is written until you confirm.** Goals and to-dos land as a list you
untick, edit and retype — including switching a row between goal and to-do,
which is the call the split gets wrong most often. Only the text you typed
leaves the machine: not your existing goals, not your tasks, not a number you
have logged.

The split follows one rule. **A to-do is finished once and ticked off; a goal
is pursued over time and has a sense of progress.** Where it could honestly be
either, it comes back as a to-do — a to-do is one line to delete, a goal is a
record to unpick.

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
| Quick capture | Gemini key | Capture launcher hidden — finance, goals and to-dos all go through it |
| Photos | `CLOUDINARY_*` | Photo UI hidden |
| Crash alerts | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Errors go to the console only |
