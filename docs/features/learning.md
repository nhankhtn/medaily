---
title: Learning
description: Track the hours you put into learning, the books and courses behind them, and the notes that come out of them.
sidebar_position: 10
---

# Learning

Learning has two tabs. **Sessions** is for the hours — timed or logged by hand, split by topic — and the books and courses you are working through. **Notes** is for what came of them: notes, concepts, bookmarks and lessons, linked to one another with `[[wiki links]]`.

| | |
| --- | --- |
| **Where** | `/learning` (Sessions) · `/learning?tab=notes` (Notes) · sidebar → Core · phone → **More**. The old `/knowledge` address still works and lands on Notes |
| **Works offline** | No |
| **Needs** | Nothing extra. Pictures in notes need Cloudinary — see [Configuration](../operations/configuration.md) |

## Rules

- Sessions for a day replace the minutes typed into that day's log. Time is entered once.
- **Time by topic** covers the last 30 days.
- A book or course moves through four statuses: backlog, reading, finished, dropped.
- Putting a topic away hides it from the pickers; sessions and notes already filed under it are left alone.
- Every note has one type: **note**, **concept**, **bookmark** (carries a URL) or **lesson**.
- Tags are comma-separated.
- A `[[wiki link]]` matches the other note's title whatever the casing.
- A link to a note that does not exist yet is kept, and starts working the day that note is created.
- A lesson carries the day it was learned, not the day it was typed. Its place is a tag.
- A lesson under two tags appears under both on the review page.

## Time a learning session

1. Open **Learning** (the **Sessions** tab).
2. On the **Timer** card, start a learning, deep-work or project run without leaving the page — or press **Full timer** to open the [Timer](./timer.md) itself.
3. Pick a topic when you start the run, so **Time by topic** fills itself.
4. Stop the run when you are done. It is listed under **Sessions**.

## Log a session by hand

1. On the **Sessions** card, press **Log a session**.
2. Enter a date, the minutes, a kind and a topic.
3. Save. The session is listed under **Sessions** and counts towards that day's minutes.

To remove a session, press the bin beside it.

## Manage topics

Topics are the areas you put hours into — Postgres, English, system design.

1. On the **Time by topic** card, press **Manage**.
2. Add a topic, rename one, or put one away.

Putting a topic away hides it from the pickers and leaves the sessions already filed under it alone.

## Track a book or course

1. On the **Books & courses** card, add a resource: a book, course, article or video, with its author, link, progress and rating.
2. Click its status to move it on: backlog, reading, finished, dropped.

## Write a note

1. Open the **Notes** tab.
2. Create a note and choose its type: **note**, **concept**, **bookmark** (give it a URL) or **lesson**.
3. Write the body in Markdown in the [editor](./editor.md).
4. Add tags, comma-separated.
5. Optionally file it under a **topic** and against a **book or course** (see below).
6. Save.

## Link notes together

1. In a note's body, write `[[Title of another note]]`.
2. Save. The link is recorded, matching the title whatever the casing.
3. Click a note's title to open it. The body renders resolved links as real links, and **Linked from** at the bottom lists every note pointing here.

A link to a note that does not exist yet reads as bold brackets until you create that note, and then starts linking on its own.

## File a note under a topic or a book

1. While editing a note, pick a **topic**, a **book or course**, or both. Both are optional and both are chosen from what Learning already knows — the same topics the timer offers.
2. Save. The note's card shows what it is filed under.

## Record a lesson

1. Create a note and set its type to **lesson**.
2. Set the day it was learned — not the day you are typing it.
3. Add its **place** as a tag — `#office`, `#home` — along with any subject tags.
4. Save. On [Reviews](./reviews.md), **Learned this period** groups the period's lessons by tag.

## How it works

**Sessions are the source of the minutes.** A session — timed or typed — is a focus session, and the sessions for a day replace the minutes typed into that day's [Daily log](./daily-log.md). The daily log shows what the sessions add up to; this is the *entered once* rule at work. Picking a topic when a run starts is what lets **Time by topic** fill itself rather than asking you to sort hours afterwards.

**Putting a topic away is not deleting it.** A topic you no longer use disappears from the pickers, but the sessions filed under it stay filed. Notes filed under it keep the link but stop showing the name, exactly as a focus session does.

**Wiki links pay off on the note being pointed at.** The value of `[[...]]` shows up in **Linked from**, on the note being pointed at rather than the one you typed in. A link to a note that does not exist yet is kept rather than dropped — an unwritten note is a note worth writing — and is recorded by title, so it resolves on its own once a note with that title exists.

**Lessons answer two questions.** Because a lesson's place is a tag rather than a fixed field, the review page can group the period's lessons by any tag: "what did I learn at work" and "what did I learn about Postgres" are both answerable. Places change, and a tag costs nothing to add.

**Search.** Notes are found by the command palette's search (`⌘K`), accent-insensitive; choosing a note opens that note. See [Navigation](../get-started/navigation.md).

## Related

- [Timer](./timer.md) — learning, deep-work and project runs become sessions here; **Full timer** opens it
- [Editor](./editor.md) — the editor notes are written in: slash menu, tables, pictures
- [Daily log](./daily-log.md) — a day's sessions replace the study and deep-work minutes typed there
- [Reviews](./reviews.md) — **Learned this period** groups the period's lessons by tag
- [Assistant](./assistant.md) — **Looking back** is given the titles of the period's lessons, but not the body of notes
- [Projects](./projects.md) — project runs started here count towards a project's time spent
- [Career](./career.md) — skills sit alongside the topics you study
- [Habits](./habits.md) and [Goals](./goals.md) — a habit or goal bound to study minutes reads the sessions
- [Navigation](../get-started/navigation.md) — search finds notes and opens them directly
- [Settings](./settings.md) — **What changed** records notes added, changed or deleted
- [Data model: learning and knowledge](../reference/data-model/learning-and-knowledge.md) — `topics`, `resources`, `notes`, `note_links`, `tags`
- [Data model: work and time](../reference/data-model/work-and-time.md) — `focus_sessions`
