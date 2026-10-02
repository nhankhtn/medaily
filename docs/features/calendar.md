---
title: Calendar
description: What you are doing and what you meant to do — the day's tasks, events, planned blocks, reminders and holidays, in day, week, month and year views.
sidebar_position: 3
---

# Calendar

The Calendar is the forward-looking half of the app: what you are doing, and what you meant to do. It opens on the day — your tasks, the time you blocked out, reminders that have come due and the priority you wrote on yesterday's log — and its week, month and year views lay out events and blocks over the same data.

| | |
| --- | --- |
| **Where** | `/calendar` (opens on Day) · sidebar → Life → Calendar · phone → **More** → Calendar |
| **Works offline** | No |
| **Needs** | Nothing extra |

## Rules

- Plans live here; the [daily log](./daily-log.md) records only what happened.
- A task added on the day view is due on the day you are looking at; you never pick a date.
- The day's **To do** shows tasks due that day and overdue tasks (marked **Overdue**); tasks due later do not show.
- A task with no due date is not part of any day's plan. It sits on **Not on a day yet**, the backlog, until you put it on a day.
- All views share one date: switching from Day to Week keeps the day you were on.
- Editing a repeating event changes every time it happens.
- A repeating event never slides into a month that lacks its date: a 31st skips short months, and 29 February returns only in leap years.
- Holidays are computed from the date, not stored. The extra days off the government announces each year around Tết and National Day are not shown.
- Reminders from People appear on the day once they have come due.
- The `.ics` export holds events only — not blocks or tasks — and is one-way.

## Add a task for the day

1. Open the Calendar. It opens on today's Day view.
2. Type the task in the box on the **To do** card.
3. Press **Add**. No project is needed; the task is due the day you are looking at.
4. Click the circle beside a task to tick it off.

## Plan tomorrow

1. Press **Plan tomorrow**. The date moves to tomorrow.
2. Add tasks. Anything you add is due that day.
3. Use the `‹ ›` arrows to reach any other day, and **Back to today** to return.

## Put a backlog task on a day

**Not on a day yet** is the backlog: tasks nobody has given a date.

1. Go to the day you want with the `‹ ›` arrows or **Plan tomorrow**.
2. On **Not on a day yet**, press the calendar icon beside the task.

The task is now due on the day being viewed, and moves up to **To do**.

## Add an event

Events are things that happen at a time.

1. Press **New event**.
2. Enter a title and a date.
3. Set start and end times, or choose **All day**.
4. Choose how it repeats and until when, if it does.
5. Add a note if you want, and save.

To change it, open it again from the day or week view. If it repeats, the dialog says before you save that the change applies to every time it happens.

## Plan a block

Blocks are time set aside for a kind of work.

1. Press **Plan a block**.
2. Enter the date, the start and the end.
3. Pick the kind: learning, deep work, project, exercise or other.
4. Optionally pick the [project](./projects.md) it is for, and add a note.
5. Save.

Open a block again from the day or week view to edit it.

## Compare plan with what happened

1. Switch to the **Week** view.
2. Read **Plan vs actual**: hours planned in blocks beside hours actually spent.

The actual hours come from [focus sessions](./timer.md), so the gap is real rather than remembered.

## Export to another calendar app

1. Press **Subscribe / export .ics**. It downloads `/api/calendar.ics`.
2. Import the file into your other calendar app.
3. Download it again whenever you want the other app brought up to date.

## How it works

**Why plans live here.** The daily log never holds intent. Events, blocks and dated tasks hold it instead, so "what I meant to do" and "what I did" stay separate and can be compared — that is what **Plan vs actual** does.

**What shows on a given day.**

| Task | Shown? |
| --- | --- |
| Due that day | yes, on **To do** |
| Overdue | yes, on **To do**, marked **Overdue** |
| Due later | no |
| No due date | not on **To do** — on **Not on a day yet** |

The backlog is a separate card on purpose. A task with no date is not part of today's plan, and repeating it on every day makes each day look busier than it is.

**What the day gathers.** Besides tasks, the Day view shows the time blocked out, reminders that have come due — including reminders set on someone in [People](./people.md) — and the priority you wrote on yesterday's [daily log](./daily-log.md). Tasks with a due date from any [project](./projects.md) appear here too; tasks added here need no project.

**Views.** Day, week, month and year are views over the same data. Day is the working view; week, month and year are the grids.

**Repeating events** expand for daily, weekly, monthly, quarterly and yearly rules, and refuse to slide a date into a month that lacks it: a 31st skips short months, and 29 February returns only in leap years.

**Holidays.** The grids mark Vietnam's public holidays and the days people keep by the lunar calendar — Tết, the Hùng Kings' Festival, Mid-Autumn and the rest — computed from the date rather than stored. The ones that are a day off work say so. The extra days the government adds around Tết and National Day are announced each year rather than calculated, so they are not shown.

**The .ics file.** It holds your events from a year back to a year ahead, one-way, so the data stays readable in any calendar app. A repeating event goes out as one event with its rule. The file needs you to be signed in, so a calendar app cannot subscribe to the address on its own — download it again to bring the other app up to date.

## Limits

- The `.ics` export does not include blocks or tasks.
- A calendar app cannot subscribe to the `.ics` address directly; you download it again by hand.
- Government-announced extra days off around Tết and National Day are not shown.

## Related

- [Projects](./projects.md) — dated project tasks appear on the day; a block can point at a project
- [Timer](./timer.md) — focus sessions are the "actual" in **Plan vs actual**
- [Daily log](./daily-log.md) — the past-only record; its tomorrow's-priority field shows on the next day
- [People](./people.md) — reminders about someone appear on the day once due
- [Goals](./goals.md) — longer arcs that projects, and so their tasks, serve
- [Assistant](./assistant.md) — **Goals & to-dos** turns a paragraph into tasks to tick off
- [Learning](./learning.md) — what a learning block is time set aside for
- [Navigation](../get-started/navigation.md) — the command palette searches tasks
- [Data model: work and time](../reference/data-model/work-and-time.md) — `project_tasks`, `planned_blocks`, `events` and `reminders`
