---
title: Journal
description: Write dated entries with a title, a mood and tags, for the thinking that does not fit on one line of the daily log.
sidebar_position: 12
---

# Journal

The journal is for the thinking that does not fit on one line of the daily log. Each entry has a date, an optional title, a body written in the editor, a mood and tags, and you can write as many as you like on a day.

| | |
| --- | --- |
| **Where** | `/journal` · sidebar → Life · phone → **More** |
| **Works offline** | No |
| **Needs** | Nothing extra |

## Rules

- An entry's date is today or earlier.
- The title is optional; an entry with no title is listed by its date.
- Mood is from 1 to 10.
- Tags are comma-separated.
- The list shows the latest 60 entries, newest first.
- A day can have many entries — separate from the one note line on the daily log.
- Search finds journal entries, but choosing one opens the journal page rather than that entry.
- Journal entries are never sent to the AI service.
- Writing in the journal is not recorded in **What changed**.

## Write an entry

1. Open **Journal** and press **New entry**.
2. Give it a date — today or earlier.
3. Optionally give it a title.
4. Write the body in the [editor](./editor.md).
5. Pick a mood from 1 to 10.
6. Add tags, comma-separated.
7. Save.

## Edit or delete an entry

1. Find the entry in the list.
2. Press the `···` button on it.
3. Choose to edit or delete.

## Find an entry

1. Press `⌘K` and type at least two characters.
2. Journal entries appear among the results. Choosing one opens the journal page rather than that entry.

## How it works

**Entries are listed newest first** — the latest 60 — each with its title (or its date), mood, the rendered body and its tags.

**Separate from the daily log.** The daily log has one quick note line per day; the journal holds as many entries as a day needs, each with its own mood and tags. Keeping them apart lets the daily log stay quick to fill.

**Kept private from the assistant.** Neither the AI narrative on Reviews nor **Looking back** in the assistant is sent journal entries — only aggregate numbers and the daily log's wins and problems.

## Limits

- Only the latest 60 entries are listed.
- Search opens the journal page, not the entry itself.

## Related

- [Editor](./editor.md) — the editor entries are written in
- [Daily log](./daily-log.md) — the one-line note for the day, as opposed to journal entries
- [Navigation](../get-started/navigation.md) — the command palette search that finds entries
- [Reviews](./reviews.md) — the AI narrative is not sent journal entries
- [Assistant](./assistant.md) — **Looking back** is not sent journal entries
- [Settings](./settings.md) — journal writing is deliberately left out of **What changed**; **Delete this account** removes the journal
- [Data model: learning and knowledge](../reference/data-model/learning-and-knowledge.md) — `journal_entries`
