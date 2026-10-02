---
title: Projects
description: Projects hold tasks and connect your work to a goal; their time spent is the sum of timed focus sessions, never typed.
sidebar_position: 6
---

# Projects

A project holds tasks, and names the goal it serves. You add and tick tasks on the project, and its time spent adds itself up from the focus sessions you time against it — so it cannot drift from reality.

| | |
| --- | --- |
| **Where** | `/projects` · `/projects/<id>` · sidebar → Core → Projects |
| **Works offline** | No |
| **Needs** | Nothing extra |

## Rules

- A project has a status: planned, active, on hold, done or dropped.
- A project can serve one goal.
- Time spent is never typed. It is the sum of focus sessions attributed to the project.
- A task's due date is optional. A dated task also appears on the Calendar's day; an undated one sits in the Calendar's backlog.
- A task does not need a project — tasks added on the Calendar's day have none.

## Create a project

1. Open **Projects** and press **New project**.
2. Enter a **Name** and a **Description**.
3. Choose a **Status** (planned, active, on hold, done, dropped) and a **Priority** (low, medium, high).
4. Set a **Start date** and an **End date** if you want them.
5. Under **Linked goal**, pick the [goal](./goals.md) it serves, or leave **No goal**.
6. Save.

The list shows each project's status and how many of its tasks are done.

## Open and edit a project

1. On **Projects**, open a project. It opens at `/projects/<id>`, with its description, time spent and tasks.
2. Press **Edit** to change any of it.

## Add and manage tasks

1. Type the task in the box at the top of the project.
2. Optionally set a due date.
3. Press Enter.
4. Tick the task when it is done.
5. To change its title, due date or priority, press the pencil.
6. To delete it, press the bin.

A task with a due date also appears on the [Calendar](./calendar.md)'s day — on **To do** on that day, and marked **Overdue** after it.

## Record time on a project

1. Open the [timer](./timer.md).
2. Choose **Project** as what you are timing, and pick the project.
3. Start, and stop when you are done.

The run becomes a focus session attributed to the project, and its time spent goes up by that much.

## How it works

**Time spent is never typed.** It is the sum of focus sessions attributed to the project, so it cannot drift from reality. This is the *entered once* rule: the session you timed is the only record of that time, and the project, the day's deep-work minutes and the week's **Plan vs actual** all read it.

**Project time is deep work.** A project session counts towards the day's deep-work minutes on the [daily log](./daily-log.md), alongside deep-work sessions.

**Work connects to intent.** Attaching a project to a [goal](./goals.md) is how the work — tasks and timed hours — connects to what you are aiming at.

**Planning the time.** On the [Calendar](./calendar.md), **Plan a block** of kind project can point at a project, so planned hours for it sit beside the hours actually timed.

## Related

- [Timer](./timer.md) — time a run as **Project** to add to a project's time spent
- [Goals](./goals.md) — the goal a project serves
- [Calendar](./calendar.md) — dated tasks appear on the day; blocks can point at a project; **Plan vs actual** compares planned and timed hours
- [Daily log](./daily-log.md) — project sessions count as the day's deep work
- [Assistant](./assistant.md) — **Goals & to-dos** splits a paragraph into goals and tasks
- [Navigation](../get-started/navigation.md) — the command palette searches projects and tasks
- [Data model: work and time](../reference/data-model/work-and-time.md) — `projects`, `project_tasks` and `focus_sessions`
