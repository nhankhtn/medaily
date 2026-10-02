---
title: Navigation
description: How the app is laid out on a computer and on a phone, the command palette that searches and logs, and the two ideas behind the design.
sidebar_position: 3
---

# Navigation

The app is the same pages on every device, arranged two ways: a sidebar and header on a computer, a dock along the bottom on a phone. The command palette (`⌘K`) searches everything, jumps to any page, and logs a number for today without leaving the screen you are on.

| | |
| --- | --- |
| **Where** | Every page |
| **Works offline** | No — only the [daily log](../features/daily-log.md) opens with no signal |
| **Needs** | The **Capture** launcher needs `AI_SERVICE_URL` — see [Configuration](../operations/configuration.md) |

## Rules

- The daily log records the past; plans live in the Calendar, planned blocks and tasks. The two are never mixed.
- A fact is entered once. Nothing asks twice for the same number.
- Search needs two characters or more and ignores accents.
- A bare date in the command palette opens that day's log, for today or earlier only.
- Metric values typed into the command palette are held to what the field accepts: 1–10 for a score, up to 24 hours of sleep, up to a day's worth of minutes.
- The **Reload** button appears only when the app is installed to the home screen.

## The two ideas behind the design

Two ideas explain most of how the pages fit together.

**The daily log records the past. Plans live elsewhere.** The daily log never holds intent; that is what the [Calendar](../features/calendar.md)'s day view, planned blocks and tasks are for. Mixing them would mean "what I meant to do" and "what I did" could never be compared.

**A fact is entered once.** A timed session on the [timer](../features/timer.md) becomes the day's study minutes. A [habit](../features/habits.md) bound to a metric ticks itself. A [project](../features/projects.md)'s time spent is the sum of sessions attributed to it. Nothing asks twice.

## Get around on a computer

1. Use the sidebar on the left. It groups every page:

   | Group | Pages |
   | --- | --- |
   | **Core** | Home (dashboard), Daily log, Habits, Goals, Projects, Learning, Timer |
   | **Life** | Health, Finance, Journal, Calendar, People, Chat, Career |
   | **Insight** | Analytics, Reviews, Settings |

2. Press `⌘B` (`Ctrl-B`) to fold the sidebar away and bring it back.
3. Use the header for the rest: the date, the running timer, search, **Today** (which opens the daily log), language, theme and sign-out.

## Get around on a phone

1. Use the dock along the bottom: **Home**, **Finance**, **Log**, **Timer** and **More**.
2. Press **More** for a grid of every other page, plus sign-out.
3. Change language and theme on the [Settings](../features/settings.md) page; on a phone they are not in the header.

## Reload the installed app

Installed to the home screen, the app has no browser bar, so there is nothing to pull or press to reload.

1. Press **Reload** in the header. It appears only in the installed app.

See [First days](./first-days.md#add-the-app-to-your-home-screen) for installing it.

## Search everything

1. Press `⌘K` (`Ctrl-K`), or use search in the header.
2. Type two characters or more. The palette looks through notes, journal entries, daily logs, tasks, projects, goals and people in one query. Accents do not matter.
3. Pick a result. Each carries the icon of what it is. A note opens on the note, a daily log on that day, and the others open the page they live on.

## Jump to a page or a day

1. Press `⌘K`.
2. Type the name of a page and pick it — or type a bare date like `2026-09-01` to open that day on the daily log. The date must be today or earlier.

## Log a number for today

1. Press `⌘K`.
2. Type a metric word and a value, for example `sleep 7.5`, `study 45` or `energy 8`.
3. Pick the entry. Today's log is updated without leaving the screen.

The words it knows:

| Word | Field |
| --- | --- |
| `energy` | Energy (1–10) |
| `mood` | Mood (1–10) |
| `sleep` | Sleep (hours, up to 24) |
| `study`, `learn` | Study minutes |
| `deep` | Deep work minutes |
| `exercise`, `gym`, `run` | Exercise minutes |
| `read` | Reading minutes |
| `ent` | Entertainment minutes |
| `english` | English minutes |

The start of a word is enough. Values are held to what the field accepts: 1–10 for a score, up to 24 hours of sleep, up to a day's worth of minutes.

## Capture something or ask a question

The **Capture** launcher sits in the bottom corner of every page when the AI service is configured. Press it, or `⌘J`, to open quick capture and the assistant. On a computer, a keyboard button above the launcher opens the list of [keyboard shortcuts](./keyboard-shortcuts.md). See [Assistant](../features/assistant.md) for what capture does.

## How it works

The sidebar, the More grid and the dock are all drawn from one list of pages, each tagged with its group. The dock holds four of them plus **More**; More shows every page not in the dock, so a page is always reachable in two taps on a phone.

Search runs as one accent-insensitive query across the kinds of record listed above, rather than one search per page, so a Vietnamese word typed without its marks still finds the note it is in.

Logging from the palette writes the same daily-log field the form does, for today, with the value held to the field's range. A bare date is offered only for today or earlier, for the same reason the daily log sends a future date back to today: a day that has not happened has nothing to record.

## Related

- [Keyboard shortcuts](./keyboard-shortcuts.md) — every key, including `⌘K`, `⌘J` and `⌘B`, and how to change them
- [Daily log](../features/daily-log.md) — what **Today**, **Log**, a bare date and the metric words open or write
- [Calendar](../features/calendar.md) — where plans live, by design
- [Timer](../features/timer.md) — the running timer in the header; sessions become the day's minutes
- [Habits](../features/habits.md) and [Projects](../features/projects.md) — the *entered once* rule in action
- [Assistant](../features/assistant.md) — quick capture behind the **Capture** launcher and `⌘J`
- [Settings](../features/settings.md) — language and theme on a phone
- [Sign in](./sign-in.md) — what sign-out clears from the device
- [Learning](../features/learning.md), [Journal](../features/journal.md), [People](../features/people.md), [Goals](../features/goals.md) — searched by the command palette
- [Data model: overview](../reference/data-model/overview.md) — where each searched record is stored
