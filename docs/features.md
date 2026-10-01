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

## Before signing in — `/welcome`

Someone who opens the bare address without a session lands on `/welcome`, a
page that says what the app is: the modules in a sentence each, the promise
about data, **Get started** (which goes to sign-in), and links to the terms and
the privacy note. It has its own language and theme switches. Where a support
channel is configured, a **Contact** link opens the same form as
[Get in touch](#get-in-touch).

Any other address goes to sign-in instead, as `/login?next=…`, and you return
to it afterwards. Someone following a link to a note has been sent somewhere;
someone typing the address may never have heard of the app, and a sign-in form
tells them nothing.

`/legal/terms` and `/legal/privacy` are public too, and they are the only pages
besides `/welcome` that search engines may index. They are what a person reads
before handing over a journal and a ledger, and a page you have to sign up to
read cannot inform that decision.

## The first few days

**The tour.** A new account opens on an eight-step tour that walks from page to
page — the dashboard, the daily log, habits, goals, the timer, notes, finance
and settings — pointing at the one control on each worth knowing. **Skip** ends
it at any step. On a device that can install the app, the end of the tour asks
once whether to add it to the home screen. **Settings → Show the introduction
again** replays it.

**Getting started.** The dashboard carries a checklist until every line is
done: log today, create one habit, set one goal, log three days, write a weekly
review. **Hide this** puts it away for good.

---

## Dashboard — `/`

Today at a glance.

- **Today** — the day's numbers against yesterday, with a link into the log.
  While today is still blank, a **two-tap quick log** (energy and sleep) takes
  its place
- **Score** — a day score and a week score; open it to see each part that
  made it and what it weighed. It is an operational signal, not a measure of
  anyone's worth, and the card says so
- **This week** — the week's totals against last week's
- **Streaks** — logging, study, deep work, exercise and reading
- **Worth noticing** — observations the rules found: sleep short several nights
  running, entertainment creeping up, a goal off pace, a habit that needs every
  remaining day this week, a new best streak. **Snooze** hides one for a week;
  **Dismiss** hides it for good
- **Trends** over 7, 30 or 90 days, once enough days exist
- **Goals** and **Habits today** — the second can be ticked from here. A habit
  bound to a metric is not ticked by hand: pressing it says so and offers the
  daily log, where its number lives

---

## Daily log — `/daily`

The spine. One entry per day, editable for any past day.

**How to use it.** Open Daily Log, fill what you care about, press Save — or
`S` while you are on the daily log and not in a text field. Four fields carry
most of the value: energy, sleep, study time and deep work. The rest is
optional.

- `[` and `]` move a day back and forward, `T` returns to today — on this page
  only
- `/daily/2026-09-01` opens one day directly; a date still in the future goes
  back to today, because a day that has not happened has nothing to record.
  Planning belongs in the Calendar
- **Copy yesterday** fills the form from the previous entry; copied fields
  stay highlighted until you touch them
- The save toast has **Undo**, which puts the day back the way it was
- What you type is kept on the device as a draft. Leave without saving and
  the page asks first; come back and the draft is restored, with a toast
  saying so
- A day whose minutes add up to more than 20 hours gets a warning, and saves
  as entered
- Minute fields offer preset chips and a +15 button, and show your 14-day
  median as a faint hint
- When focus sessions exist for the day, study and deep work show what they
  add up to — "45 min from 2 focus sessions". The sessions decide the number
  every other page reads; this is the *entered once* rule at work
- **Delete** removes the day's entry
- The dashboard offers a **two-tap quick log** (energy and sleep) when today
  is still blank
- When two or more of the last seven days are missing, a banner offers
  **Catch-up** (`/daily/catch-up`): one row per missing day from the last two
  weeks, saved in one go

The win, problem, tomorrow's priority and note fields use the same editor as
notes; see [Writing in the editor](#writing-in-the-editor).

Blank means *not recorded* — never zero. A skipped day does not drag an
average down.

### With no signal

The daily log works offline, because it is the screen you reach for in a lift
or on a metro. Adding a transaction and stopping the timer work offline as
well; see [Finance](#finance--finance) and [Timer](#timer--timer).

Open the app once with a connection and it keeps a copy of the page. After
that, opening `/daily` with no network shows the form instead of a browser
error. Fill it, press Save, and it is kept on the device — the toast says so
rather than claiming it was saved. It goes up on its own the next time the app
has a connection, on whatever screen you happen to be on, and a second toast
says how many days went.

Two things worth knowing. Sending the same day twice is harmless: the write
replaces the row for that date rather than adding one, which is what made the
daily log the safe place to start. And every other screen still needs a
connection, and a day held on the device is dropped from the queue if the
server ever refuses it outright, so a bad entry cannot block the good ones
behind it.

Signing out clears everything of yours the device is holding: the cached page,
anything still waiting to be sent, and the drafts of days you typed but never
saved. All three are your own day in a different state, and none should be
there for whoever signs in next — an unsent day would land in their account,
and a draft would reappear in their form. So sign out on a device with days
still waiting and those days are gone; get a connection first.

### Set up — what the form asks

The **Set up** button beside the date opens two lists. They live on the form
rather than in Settings because the moment you want them is the moment you are
looking at the form.

**What the day log asks.** Turn off the built-in fields you never fill. Each
one says how many habits and goals read it, since those stop counting when it
is off. Nothing is deleted: a day that already has a value still shows the
field, so nothing you recorded goes out of sight.

**Your own activities.** The built-in fields are not the ceiling.

**Set up → New activity.** Give it a name in both languages; the key fills
itself from the English name and stays editable. Pick a kind — number, minutes,
scale 1–10, yes/no, or text — and a unit if it helps.
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

**How to use it.** Press **New habit**, choose how often — every day (with a
number of times per day), a number of times a week, on chosen weekdays, or
every N days — and tick it as you go. Each habit shows its last few days and
its completion rate over 30 days; a weekly habit shows how far into the week's
count you are. Ticking is for today, here or from the dashboard.

**Or do not tick it.** Under **Tick it automatically**, bind the habit to a
metric — "sleep ≥ 7h", "study ≥ 60 min" — and it completes itself from the
daily log. Custom metrics work here too. A derived tick disappears if the
underlying number changes, so the two can never disagree. Binding a habit
checks the days you had already logged, and the toast says how many it ticked.

A streak survives one missed day inside a week when **Settings → Grace day for
streaks** is on; the streak shows as held rather than broken.

**Archive** in the edit dialog stops a habit appearing and keeps its history.

---

## Goals — `/goals`

Longer arcs, in one of three shapes:

- **Manual** — you set the percentage
- **Metric** — "300 study minutes a week". Pick the metric, how to total it
  (sum, average, days done, latest), the window, the target, and whether the
  target is a floor or a ceiling. Progress then keeps itself
- **Milestones** — typed one per line, each counting the same; tick them off
  on the goal's card

A goal also has a category, a priority, a start date and an optional deadline.
With a deadline, the card says how many days are left, whether you are
**Ahead**, **On track** or **Behind**, and the rate per day still needed to
finish on time. **Archive** in the edit dialog puts a goal away.

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

Projects hold tasks.

**How to use it.** **New project** takes a name, a description, a status
(planned, active, on hold, done, dropped), a priority, start and end dates,
and the goal it serves. The list shows each project's status and how many of
its tasks are done; open one (`/projects/<id>`) for its description, time
spent and tasks, and **Edit** to change any of it.

Add a task with the box at the top of a project, optionally with a due date,
and press Enter. Tick it when it is done; the pencil changes its title, due
date and priority, and the bin deletes it. A dated task also appears on the
Calendar's day.

Time spent is **never typed** — it is the sum of focus sessions attributed to
the project, so it cannot drift from reality. Time a run as **Project** on the
timer and pick the project.

---

## Learning — `/learning`

Two tabs: **Sessions** (`/learning`) for the hours, **Notes**
(`/learning?tab=notes`) for what came of them. The old `/knowledge` address
still works and lands on Notes.

### Sessions

- **Timer** starts a learning, deep-work or project run without leaving the
  page; **Full timer** opens the timer itself
- **Sessions** lists what was timed or logged. **Log a session** records one
  by hand — a date, minutes, a kind and a topic — and the bin removes one.
  Sessions for a day replace the minutes typed into that day's log
- **Time by topic** is the last 30 days, split by topic
- **Books & courses** tracks resources — books, courses, articles, videos —
  with author, link, progress and rating. Click the status to move it on:
  backlog, reading, finished, dropped

**Topics** are the areas you put hours into — Postgres, English, system
design. **Manage** on the *Time by topic* card opens them: add one, rename it,
or put it away. Pick a topic when you start a timed run and the chart fills
itself; putting one away hides it from the pickers and leaves the sessions
already filed under it alone.

### Notes

Notes are written in Markdown, and each has a type: a plain **note**, a
**concept**, a **bookmark** (which carries a URL), or a **lesson** (below).
Tags are comma-separated.

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

### Writing in the editor

The same editor is used for notes, journal entries, the daily log's written
fields, review answers, and the notes on habits and people.

Type `/` at the start of a line or straight after a space for a list of
blocks — text, three sizes of heading, bulleted and numbered lists, a to-do
list, quote, code, divider and table. Typed against a word, as in `abc/`, it
does nothing. Markdown shorthands work as you type: `#` for a heading, `-` for
a list, `>` for a quote, a backtick fence for code. The `?` button in the
editor's corner lists all of them, so the question "how do I make a table" has
an answer inside the editor rather than outside it. The editor also opens
full-screen when the dialog is too small to write in.

- **Select text** and a small toolbar appears: bold, italic, strikethrough,
  code and a link. `⌘B` and `⌘I` work too
- **Hover a block's left margin** for two controls: the plus adds a block
  underneath, and the dots are a handle to drag the block somewhere else
- **Tables** start as a 3×3 grid with a header row; Tab moves to the next
  cell, and Tab in the last cell adds a row
- **Pictures** can be pasted in or dropped on the box, up to 15 MB each. They
  upload to Cloudinary on their own, with a progress bar where they will land;
  the note keeps a link, not the image itself. Pictures nothing refers to any
  more are cleared overnight — see [Overnight](#overnight--apicronnightly)

---

## Timer — `/timer`

**How to use it.** Choose what you are timing — learning, deep work, project,
English, reading, exercise, entertainment, or one of your own minute-measured
activities — count up or count down, say what it is for, press Start. `Space`
starts and pauses while you are on the timer page. The badge in the header
follows you around the app, and the tab title carries the clock so another tab
still shows the run.

On finishing, each run is filed where it belongs:

- **Learning**, **deep work** and **project** become a focus session, which
  makes up the day's study or deep-work minutes
- **Exercise** becomes a workout under Health, with its type
- **English**, **reading** and **entertainment** are added onto that day's log
- one of **your own** activities is added onto that day's value for it

A run under 30 seconds is discarded rather than recorded, and one left going
is capped at 8 hours. Starting a new run while one is going saves the running
one first, and says where it went. The screen is kept awake while a run is
going.

**With no signal.** A run is timed on the device, so it keeps going with no
connection. Stopping it offline keeps the run on the device — the toast says
so — and it uploads the next time the app is online, on any screen, with a
toast saying how many runs went up.

---

## Health — `/health`

Workouts, body measurements and nutrition, over the last 90 days: how many
workouts, the total time, and the latest weight sit at the top.

- **Log a workout** — type, date, duration, distance, calories, effort (RPE)
  and a note, plus one row per exercise with sets, reps and weight. Saving
  copies the minutes into that day's exercise on the daily log; sets and reps
  live here, because the daily log only needs the minutes
- **Log measurement** — weight, body fat, waist and resting heart rate. Weight
  is drawn as a chart with its 7-day average
- **Nutrition** — today's calories, protein, carbs, fat and water, with the
  last week listed below

A timed exercise run arrives here as a workout on its own.

---

## Finance — `/finance`

Accounts, categories, transactions, budgets, assets and investments.

**How to use it.** Add an account first — transactions need somewhere to sit.
Then log income, expense or transfer. A transfer moves money between your own
accounts and counts as neither income nor expense.

Amounts format as you type: `100000` becomes `100.000`. Investment prices are
typed by hand — the app fetches no market data.

**Four tabs.**

- **Overview** — net worth, cash, and this month's income and expense against
  last month's; the add form; the ledger, with filters and a search
- **Accounts** — debts, accounts, categories, assets and liabilities, and
  investments. A category can carry a *note for AI* describing what belongs in
  it, which helps quick capture pick it. Deleting an account or category that
  something is filed under hides it instead, and the entries keep it
- **Budgets** — one month at a time
- **Report** — what the numbers add up to

**Budgets** are a monthly limit per category; click a budget's name to change
the amount. The tab totals them, so the question "how much did I allow myself
this month" has an answer without adding up rows. The arrows move between
months: back as far as you like, forward no further than the month now
running.

A new month starts with last month's budgets. The nightly job checks whether
the month now running has any budget yet, and if it has none, copies last
month's in. Setting even one figure for the month first counts as handling it
yourself, and nothing is copied over it. A current month that is still empty —
the job has not run yet, or is not set up — offers **Copy last month**, which
does the same thing on the spot. A month you have never opened therefore still
has limits to go over, which is the only way the overspending it reports means
anything. You can move back to any past month and see how it ended — and set a
budget on a month already gone, because the reason to look at one is usually
to work out what it should have been. Nothing is ever copied into a past
month, so it keeps showing what was actually set.

**Paying someone.** Someone under People with payment details — a bank
account, a MoMo number, or a picture of their QR code — can be paid from the
add form. Type the amount, press **Send money**, and pick who. That saves the
expense against them and opens a sheet with the amount, their name, bank and
account holder, the reference, and a QR code:

- Where their bank account is known, the QR is made for this transfer, so
  scanning it fills in the account, the amount and the reference. Otherwise it
  is their own code, and the amount is typed when you scan
- **Copy account number** and **Open MoMo** work on any device
- **Open** *your bank's app* appears only on a phone, only for the banks that
  registered a link, and only once the account you are paying from and the one
  you are paying to are both known — your bank is the app that opens, theirs
  is where the money lands. Some bank apps open with the transfer filled in;
  the rest open on their home screen, and the sheet says so

The app cannot see whether the money moved, so it asks. **Sent** marks the
transfer as done. **Later** closes the sheet, and the row keeps a send button
lit in the ledger until you come back and confirm.

**With no signal.** Adding a transaction works offline, the way the daily log
does. Open `/finance` once with a connection and the page is kept; after that
you can type an expense with no network and it is held on the device, shown
above the ledger as waiting, and sent on the next connection.

Only *adding*. Editing and deleting still need a connection: two devices
changing the same row would need a rule for which change wins, and adding does
not. Quick capture needs a connection too — it asks a model to read your
sentence, and there is nothing to queue.

Sending the same transaction twice is harmless. The id is decided by the
browser before the first attempt, so a retry after a reply that never arrived
lands on the same row rather than charging the coffee again. This is the piece
the daily log got free from its date, and the reason finance came second.

**Quick capture** can read a sentence like *"banh mi 30k this morning, coffee
25k, lunch 55k"* and propose the transactions; nothing is saved until you
confirm.

**Debts.** A transaction can name someone from your contacts, and that is what
makes it a debt. Which way it counts follows from the transaction itself: money
going out is you lending or paying someone back, money coming in is them paying
you back or you borrowing. Those add up to one number per person — above zero
they owe you, below zero you owe them — shown in a card on the Accounts tab.
Nothing is ever marked "settled": settling a debt *is* recording the repayment,
so a debt cannot go stale behind a tick box someone forgot.

Money you lend is not money you spent, so debts are left out of the income and
expense totals and out of the report. Your account balance still drops, because
the money really did leave; your net worth does not, because you are owed it.
A transfer moves money between two accounts you already own, so it cannot be a
debt and the field is not offered.

### Report

**Balance over time** comes first: the last 30, 90 or 180 days, for one
account or all of them.

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

## Journal — `/journal`

For the thinking that does not fit on one line of the daily log.

**How to use it.** Press **New entry**. Give it a date (today or earlier), an
optional title, the body in the [editor](#writing-in-the-editor), a mood from 1
to 10 and comma-separated tags. Entries are listed newest first — the latest
60 — each with its title (or its date), mood, the rendered body and its tags.
The `···` button on an entry opens it to edit or delete.

Search finds journal entries, but choosing one opens the journal page rather
than that entry.

---

## Calendar — `/calendar`

Day, week, month and year views over the same data. Day is described above;
the rest are the grids.

**Events** are things that happen at a time. **Blocks** are time set aside for
a kind of work — learning, deep work, project, exercise or other — optionally
pointed at a project. This is the forward-looking half the daily log
deliberately lacks.

**How to use it.** **New event** takes a title, a date, start and end times or
*All day*, how it repeats and until when, and a note. **Plan a block** takes a
date, start and end, the kind, the project and a note. Either opens again from
the day or week view to be edited. Editing a repeating event changes every time it happens, and the dialog
says so before you save.

The week view adds **Plan vs actual**: hours planned in blocks beside hours
actually spent, which come from focus sessions — so the gap is real rather
than remembered.

Repeating events expand for daily, weekly, monthly, quarterly and yearly
rules, and refuse to slide a date into a month that lacks it: a 31st skips
short months, and 29 February returns only in leap years.

**Holidays.** The grids mark Vietnam's public holidays and the days people keep
by the lunar calendar — Tết, the Hùng Kings' Festival, Mid-Autumn and the rest
— computed from the date rather than stored. The ones that are a day off work
say so. The extra days the government adds around Tết and National Day are
announced each year rather than calculated, so they are not shown.

Reminders from People appear on the day view once they have come due.

**Subscribe / export .ics** downloads `/api/calendar.ics`: your events from a
year back to a year ahead, one-way, so the data stays readable in any calendar
app. Repeating events go out as one event with its rule. The file needs you to
be signed in, so a calendar app cannot subscribe to the address on its own —
download it again to bring the other app up to date. Blocks and tasks are not
in it.

---

## People — `/people`

A personal CRM. Record who matters, how often you mean to be in touch, and
what you last talked about — the point is being told when it has been too
long.

**How to use it.** **New person** takes a name, the relationship (partner,
family, friend, colleague, mentor, other), company, role, birthday, phone,
email, how often to stay in touch, notes in Markdown, and payment details. The
pencil beside a person's notes edits them; removing someone asks once more and
then offers Undo.

- **Log interaction** records when you were in touch, how (in person, call,
  message, email, other) and what it was about. **Recent interactions** lists
  the latest
- **Time to reach out** lists everyone past their interval, by how many days,
  with when you last spoke
- **Birthdays coming up** covers the next 30 days
- **Reminders** are a thing to do by a date, optionally about someone. **Done**
  clears one. A reminder that has come due also shows on the Calendar's day

**Payment details** are what [Send money](#finance--finance) in Finance uses:
a bank and account number with the holder's name, a MoMo number or receive
link, or a picture of the QR code they gave you. One is enough. The picture is
read when you choose it: if it holds a bank account the app knows, the account
number is taken from it and every transfer to them gets its amount filled in;
otherwise it still scans, and the amount is typed by hand. A picture with no
code in it is refused.

**Photos.** With Cloudinary configured, each person has a gallery: upload
straight from the browser, click a thumbnail for the full-size image. The grid
pulls small, cheap images and the full view pulls a good one, from one stored
original.

---

## Chat — `/chat`

Conversations with the other people who use this instance. It is a side room,
not a product: the app is a personal log, and chat exists because some of what
you track is arranged with somebody else.

**Rooms are of two kinds.** A direct room is between two people and there can
only ever be one of them — opening a conversation twice finds the first rather
than making a second. A group room has a name and as many people as you
invite.

**Getting someone in.** The gear beside the room's name opens a short menu;
**Add someone** offers a link to copy or an email address to invite. A link is
good for 48 hours and for **one** person: it is a credential, so it is spent
the moment it is used.

An invite link has the form `/chat/join/<code>`, and opening it lands on the
room list with a dialog naming the room you were asked into, rather than a
page of its own — you are being asked a question, not sent somewhere. Naming
the room does not spend the code; only **Join the room** does. That matters
because a link pasted into a chat app is fetched by its preview bot before
anyone clicks it. Someone already in the room is offered **Open the room**
instead.

**Nothing is emailed.** An address is written down, and the next time somebody
signs in with that address within the 48 hours, they are seated in the room —
which also means a person can be invited before they have an account. The
toast says nothing was sent, so send them the link yourself if they should
know.

The email field never says whether that address has an account. Both answers
read the same, deliberately: a form that says "no such person" is a form that
tells you who is here.

**Sending.** Your own message appears the moment you send it, not when the
server agrees, and settles in place when it does. Emoji and stickers sit
beside the box; a message that is nothing but emoji is drawn large, the way
every chat app has trained people to expect. Fifty messages load at a time and
older ones arrive as you scroll up.

Beside each message sits one button, a **smiley** — on a computer when you
hover the message, on a phone always, since there is no hover there. It opens
a panel with everything you can do to that message:

- the six **reactions** along the top. There is one reaction per person:
  choosing another moves yours rather than adding a second. Tap a reaction
  under the words to take it back
- **Reply**. The message you are answering shows above the box with **Cancel
  reply**, and the reply carries a quote of it. If the original is later
  recalled, the quote says so too
- **Recall**, on your own messages only

A recalled message has no button at all.

**Taking it back.** You can recall your own message, and only your own. The
row stays with a line saying it was withdrawn — the conversation is never
rewritten to look like something was not said.

**What is waiting.** The nav carries how many rooms have something unread,
and the list says how many messages each one holds — a room list that looks
the same whether or not anybody wrote to you is one you have to open to use.
Your own messages never count: sending something is not a reason for a room to
ask to be read. Opening a room marks it read from the newest message that has
actually landed, so a bubble still in flight cannot move the mark past
something you have not seen.

**Who is where.** Your messages sit on the right, everyone else's on the
left. Messages one person sends within five minutes of each other, on the same
day, stack into a run: the name is written once, inside the first bubble, and
the face sits beside the last. The side says who, which is why a name is only
drawn on other people's. A line with the date separates one day from the next,
and each bubble carries its time in the corner. When someone is typing, you see
it — the one live signal that carries any content at all.

**Group picture.** The room's owner can set a picture for a group room from
the gear menu, change it, or remove it. It must be an image under 5 MB, and it
needs Cloudinary.

### Who may do what

Only the person who made the room can invite, rename, change the picture,
remove somebody, or delete it. Everybody else can read, write, recall their
own, and leave.

**Deleting a room takes the messages with it, for everyone.** There is no
copy, and nothing asks twice beyond the confirmation.

This is decided on the server, not by hiding menu items. The ranks live on the
member's seat in the room rather than on a "who made this" column, so a room
that predates that column still knows its owner.

### What the server can read

Messages are **locked before they reach the database** when
`CHAT_MESSAGE_KEY` is set. Each message is encrypted under a key of its own,
which is then wrapped once per key in the environment — which is how a spare
key opens everything the main one can.

Be clear about what this is: **the server holds the key, so this is not
end-to-end.** It protects a database dump, a stray backup, and whoever runs
the cluster. It does not protect against someone who has the application
server. Telegram's group chats make exactly this trade, and for the same
reason — a conversation you can read on a new device is a conversation the
server can read too.

Without the variable, messages are stored as they always were, and rows of
both kinds live together: switching it on migrates nothing, and switching it
off strands everything written while it was on.

**Lose the keys and the messages are gone.** There is no recovery. Keep a copy
somewhere that is not the database, and set both keys *before* the first
message — a key added later opens nothing written before it.

How new messages arrive without a reload is in [realtime.md](realtime.md).

---

## Career — `/career`

Three cards.

- **Skills** — **Add skill** takes a name, a category, a level from 1 to 5 and
  an optional target. Each skill is drawn as five pips, current level filled
  and target outlined, with how far there is still to go
- **Achievements** — **Add achievement**, in the page header, takes what
  happened, the date (today or earlier), the impact and a link. The list shows
  each with its date and impact
- **Portfolio** — **Add item** takes a title, a link, a description and the
  tech involved, comma-separated

Entries are added, not edited: the page has no way to change or remove one
yet.

---

## Analytics — `/analytics`

Trends and comparisons over 7 days, 30 days, 90 days or a year.

**Trends** chart focus time, sleep, energy and entertainment day by day, with
the stretch's total and average. **Comparisons** split the days into two groups and
compare their averages — sleep and energy, sleep and focus time, exercise and
energy, entertainment and focus time, sleep and mood. **Time allocation** shows
where the hours went.

Nothing appears until there is enough data to mean anything. A comparison
needs at least 21 days with both values recorded and at least 7 in each group,
and a difference too small to separate from ordinary variation is withheld;
each card says which of these it is waiting for. **How this was calculated**
on a card shows how many days qualified and how they split.

Everything is stated as an association, never a cause. A test enforces that
wording in both languages.

---

## Reviews — `/reviews`

Weekly, monthly and yearly, each with the period's numbers computed for you
and five things to write: what worked, what did not, what to change, the top
priority, and a free reflection.

**How to use it.** Pick weekly, monthly or yearly and move between periods with
the arrows. Read the numbers: days logged, the period score, average energy and
sleep, study, deep work, exercise days, reading, entertainment, habit
completion, and the best and hardest day.

- Above the questions, **Last period you wrote: "…" Did it happen?** holds up
  the priority you set last time
- **From your daily wins** and **From your daily problems** gather what you
  wrote on the daily log that period; **Use these** pulls them into the text
  rather than leaving you to remember them
- **Learned this period** groups the period's lessons by tag

**Save draft** keeps the text. **Finalize** freezes the numbers, so the review
still shows what it showed then; a draft recomputes every time you open it. A
finalized review can be reopened, or have its numbers recomputed on purpose.

With the AI service configured, an AI narrative can be generated for a week or a
month. Only aggregate numbers and rule-generated observations are sent — no
notes, no journal entries, no names — and the result is always labelled.

---

## Getting around

### On a computer and on a phone

**On a computer**, the sidebar groups every page under Core, Life and
Insight. The header carries the date, the running timer, search, **Today**
(which opens the daily log), language, theme and sign-out.

**On a phone**, a dock along the bottom holds Home, Finance, Log, Timer and
**More**; More opens a grid of every other page, plus sign-out. Language and
theme are on the Settings page there.

Installed to the home screen, the app has no browser bar, so the header gains a
**Reload** button. It appears only there.

The **Capture** launcher sits in the bottom corner on every page when the AI
service is configured. On a computer a keyboard button above it opens the
shortcut list.

### Search and commands

**Command palette** — `⌘K`. It is also the search: two characters or more and
it looks through notes, journal entries, daily logs, tasks, projects, goals
and people in one accent-insensitive query, each result carrying the icon of
what it is. A note opens on the note and a daily log on that day; the others
open the page they live on.

The same box jumps to any page, opens a bare date like `2026-09-01` (today or
earlier), and logs a metric for today without leaving the screen. The words it
knows are `energy`, `mood`, `sleep`, `study` (or `learn`), `deep`, `exercise`
(or `gym`, `run`), `read`, `ent` (entertainment) and `english` — the start of
a word is enough, so `sleep 7.5`, `study 45` and `energy 8` all work. Values
are held to what the field accepts: 1–10 for a score, up to 24 hours of sleep,
up to a day's worth of minutes.

### Quick capture and the assistant

**Quick capture** — `⌘J`, or the Capture launcher. Both need the AI service;
without it neither is there.

The box opens on the **Assistant**. Ask in your own words, or tap a starter —
*How did this week go?*, *What did I spend this month?*, *What is still
unfinished?*, *How do I use this app?* While it works, the panel says which
step it is on and how it read the question (**Read as: …**). That reading is
shown on purpose: a question taken the wrong way is cheaper to rephrase than a
wrong answer is to read.

- If what you typed is something to file rather than a question — spending, or
  a plan — the assistant says so and hands it to that form, already read, for
  you to check
- An answer to a message that had an amount in it offers **File as spending**,
  in case it was meant as a record rather than a question
- **Start over** clears the conversation; closing the panel ends it too
- Eight messages a minute; past that it asks you to wait

Type `/` and the box lists where a note can go instead; **Back to the
assistant** returns. You pick, rather than it guessing, so a note that reads
like two things cannot land in the wrong one.

| `/` | What it reads |
| --- | --- |
| **Finance** | A day's spending from one sentence — *"banh mi 30k, coffee 25k"* |
| **Goals & to-dos** | A paragraph of intentions, split into goals to pursue and tasks to tick off |
| **Looking back** | A conversation about how a week or a month went |

**Nothing is written until you confirm.** Goals and to-dos land as a list you
untick, edit and retype — including switching a row between goal and to-do,
which is the call the split gets wrong most often. For these, only the text
you typed leaves the machine: not your existing goals, not your tasks, not a
number you have logged.

The split follows one rule. **A to-do is finished once and ticked off; a goal
is pursued over time and has a sense of progress.** Where it could honestly be
either, it comes back as a to-do — a to-do is one line to delete, a goal is a
record to unpick.

**Looking back** starts from *This week*, *Last week* or *This month*, or from
a question, and takes follow-ups — **Give me a few suggestions** among them.
It is given the period's numbers and the observations behind *Worth noticing*,
compared with the period before, plus the wins and problems you wrote on the
daily log that period and the titles of its lessons. Journal entries, the body
of notes and other people's names are not sent.

### Shortcuts

**⌘B / Ctrl-B** folds the sidebar away and brings it back. Unlike `⌘K` and
`⌘J`, it does nothing while the cursor is in a text field, because in the
editor those keys mean bold.

**Keyboard shortcuts** — press `?`, or use the keyboard button beside the
capture launcher, or open it from Settings. **Every shortcut is editable**:
click a key, press the new one. Two-key sequences work, conflicts are refused,
and the changes follow you to another device.

| Where | Default |
| --- | --- |
| Anywhere | `⌘K` search, `⌘J` quick capture, `?` this list, `⌘B` sidebar |
| Jump to | `g` then `o` home, `d` daily log, `h` habits, `g` goals, `a` analytics, `s` settings |
| On the daily log | `[` previous day, `]` next day, `T` today, `S` save |
| On the timer | `Space` start or pause |

Bare keys are off while the cursor is in a text field, so typing an `s` never
saves the day out from under you. Escape, the arrows, Enter and the digits stay
fixed — they are controls, not preferences, and a bare digit would swallow the
1–10 scores on the daily log. The shortcut list is a keyboard's business, so
Settings does not offer it on a phone.

---

## Settings — `/settings`

From the top:

- **Profile** — your photo (change or remove it, under 5 MB; needs
  Cloudinary), how you signed in, and since when. **See history** opens
  [What changed](#what-changed)
- **Language** (English or Vietnamese) and **theme** (Light, Dark or Pink),
  applied at once; **Show the introduction again** replays the tour
- **Add to home screen**, where the browser can do it and the app is not
  installed yet. Safari has no button for it, so on an iPhone this shows the
  two taps instead. Installed, the app opens without the address bar and
  anything saved offline is safe from being cleared
- **Timezone** and the **day rollover hour** — anything logged before that
  hour belongs to the previous day. Changing the timezone only changes what
  counts as today; past entries keep the date they were recorded with
- **Week starts on** Monday or Sunday
- **Grace day for streaks** — one missed day inside a week pauses a streak
  instead of breaking it
- **Score weights**, which must add up to 100%, with a reset to the defaults
- **Keyboard shortcuts** — not shown on a phone
- **Your data**
- **Get in touch**, where a support channel is configured
- **Delete this account**

Your own activities, and which built-in fields the daily log asks, are under
**Set up** on the daily log rather than here.

**Your data** exports everything as JSON, or the daily logs as CSV, and
imports back with a dry run that reports what would be created before anything
is written. The export endpoint also gives CSV for other tables
(`/api/export?format=csv&table=…`), though only the daily logs have a button.
For a real backup of the database itself there is `scripts/backup.sh`.

**Delete this account** removes everything under it — the journal, the ledger,
the health log, the people and the photos — with no undo and no copy kept. To
confirm, type the name the dialog shows: your username, or the Google address
you signed in with. Take an export first if you want one.

### What changed

A trail of what was added, changed, archived or deleted lately: transactions,
accounts and categories; habits, goals, notes and people; chat rooms (made,
joined, left, invites, removals, renames, deletions); and signing in and out.
Only the last `ACTIVITY_LOG_DAYS` days are kept — 90 unless configured — and
it needs `MONGODB_URI`.

It deliberately stops there. Ticking a habit, saving a day's log and writing in
the journal are not recorded: a trail that records every habit ticked buries
the entries anyone actually goes looking for, and those are the ones about
access and about money.

### Get in touch

**Get in touch** sends a note — something broken, something missing — straight
to whoever runs the instance, over Telegram. A signed-in note carries who sent
it; on `/welcome`, where nobody is signed in, there is a field for where to
answer, and left blank the note goes one way. Nothing is stored: it goes to the
chat and nowhere else. Four notes an hour from one place. Without Telegram
configured, the form is not offered.

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

**On the sign-in page.** A Google account that has signed in on this device
before is offered as **Continue as** *its address*, with **Forget this
account** beside it. Where the browser supports it, Google's One Tap prompt
offers the same; it is never loaded on iOS, where it could not draw anything.
Too many attempts from one place in 15 minutes and the page asks you to wait.

**Staying signed in.** A session lasts 30 days, and is renewed as you open
pages, so someone who uses the app most weeks is not signed out. It ends six
months after the sign-in that started it, however often it was renewed.

**These documents.** `/docs` serves this documentation as a site, built from
`docs/` with Docusaurus into `public/docs/`. It describes the schema and the
reasoning behind the Firestore rules, which is the owner's business, so only
the account signed in with the configured `AUTH_USERNAME` and `AUTH_PASSWORD`
can open it. Anyone else who is signed in gets the same 404 as a page that
does not exist.

---

## Overnight — `/api/cron/nightly`

Once a day a scheduler calls this address — `vercel.json` sets 17:00 UTC,
which is midnight in Vietnam — with `Authorization: Bearer $CRON_SECRET`. The
route sits outside the sign-in gate, since the scheduler has no session, so the
secret is the only thing guarding it: without `CRON_SECRET` it answers 503 and
does nothing, and with a wrong or missing header it answers 401.

It does three things, in this order, for every account:

1. **Carries budgets forward** into a month that has none — see
   [Finance](#finance--finance). Cheap, and the one somebody notices missing,
   so it goes first
2. **Clears pictures nothing refers to.** A picture pasted into a note and
   later deleted, or never saved, is removed from Cloudinary once it is old
   enough that nobody can still be writing the note it was meant for
3. **Sweeps leftover live-update channels** for chat — see
   [realtime.md](realtime.md)

One failing account does not stop the others. A report goes to Telegram only
on a night when something was copied or deleted, or something failed — a
message every quiet night is how a channel stops being read, and the same
channel carries the failures.

---

## Optional services

Everything below is off unless configured, and the UI mostly hides rather than
breaks; the table says what you get without each one.

| Service | Variables | Without it |
| --- | --- | --- |
| Google sign-in | `NEXT_PUBLIC_FIREBASE_*`; One Tap also needs `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | The Google button does not appear |
| AI service | `AI_SERVICE_URL` / `AI_SERVICE_TOKEN` (`medaily-ai`) | No narrative on Reviews, and no quick capture or assistant — the launcher and `⌘J` are not offered, so finance, goals and to-dos are entered through their own forms |
| Pictures | `CLOUDINARY_*` | Galleries under People are hidden; profile photos and group pictures say storage is not set up; pictures pasted into the editor do not upload |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Errors go to the console only; no Get in touch form, in Settings or on `/welcome`; no nightly report |
| Nightly job | `CRON_SECRET` | The job refuses to run: budgets are not carried forward on their own (**Copy last month** still works), and unused pictures stay |
| Activity trail | `MONGODB_URI`, `ACTIVITY_LOG_DAYS` | No What changed, and no **See history** in Settings |
| Chat | `MONGODB_URI` | Chat still appears in the nav, but its pages answer 404 |
| Locked messages | `CHAT_MESSAGE_KEY`, `CHAT_MESSAGE_KEY_SPARE` | Messages are stored as plain text in Mongo |
| Live updates | `NEXT_PUBLIC_REALTIME_ENABLED=1` (read at build time), `FIREBASE_SERVICE_ACCOUNT` | Chat checks for new messages on a slow timer instead. The service account lets a password sign-in listen too, and is what the nightly sweep uses; see [realtime.md](realtime.md) |
