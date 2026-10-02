---
title: Writing in the editor
description: The one editor used for notes, journal entries, the daily log's written fields, review answers, and notes on habits and people.
sidebar_position: 11
---

# Writing in the editor

Everywhere you write more than a line, you write in the same editor: notes, journal entries, the daily log's written fields, review answers, and the notes on habits and people. Learn it once and it works the same everywhere. It writes Markdown, and the `?` button in its corner lists everything it can do.

| | |
| --- | --- |
| **Where** | [Learning](./learning.md) notes · [Journal](./journal.md) · [Daily log](./daily-log.md) win, problem, tomorrow's priority and note · [Reviews](./reviews.md) answers · notes on [Habits](./habits.md) and [People](./people.md) |
| **Works offline** | Wherever the page it sits on does — on the [Daily log](./daily-log.md), yes |
| **Needs** | Nothing extra. Pictures need Cloudinary — see [Configuration](../operations/configuration.md) |

## Rules

- `/` opens the block menu only at the start of a line or straight after a space. Typed against a word, as in `abc/`, it does nothing.
- Markdown shorthands work as you type.
- `⌘B` is bold and `⌘I` is italic inside the editor — which is why the sidebar shortcut `⌘B` does nothing while the cursor is in a text field.
- A new table starts as a 3×3 grid with a header row.
- Pictures can be up to 15 MB each.
- The note keeps a link to a picture, not the picture itself.
- Pictures nothing refers to any more are cleared overnight.

## Insert a block

1. Put the cursor at the start of a line, or straight after a space.
2. Type `/`. A list of blocks opens: text, three sizes of heading, bulleted and numbered lists, a to-do list, quote, code, divider and table.
3. Pick the block you want.

## Use Markdown shorthands

They work as you type:

| Type | You get |
| --- | --- |
| `#` | a heading |
| `-` | a bulleted list |
| `>` | a quote |
| a backtick fence (```` ``` ````) | a code block |

The `?` button in the editor's corner lists all of them, so the question "how do I make a table" has an answer inside the editor rather than outside it.

## Format text

1. Select some text. A small toolbar appears.
2. Choose bold, italic, strikethrough, code or a link.

`⌘B` and `⌘I` work too.

## Move or add a block

1. Hover a block's left margin. Two controls appear.
2. Press the plus to add a block underneath, or drag the dots handle to move the block somewhere else.

## Add a table

1. Type `/` and choose **table**. It starts as a 3×3 grid with a header row.
2. Press Tab to move to the next cell.
3. Press Tab in the last cell to add a row.

## Add a picture

1. Paste a picture, or drop it on the box. Each can be up to 15 MB.
2. A progress bar shows where it will land while it uploads to Cloudinary on its own.
3. When it is done, the picture appears in place. The text keeps a link to it, not the image itself.

## Write full-screen

When the side panel is too small to write in — on a computer, while writing a note:

1. Press **Fill the screen** in the panel's header.
2. Press **Back to the side panel** to return. The choice is remembered for next time.

On a phone the panel already stands almost the full height of the screen, so the button is not shown.

## How it works

**One editor, one set of habits.** Notes, journal entries, the daily log's written fields, review answers and the notes on habits and people all use the same component, so a shortcut learned in one place works in every other, and what you write is Markdown everywhere.

**Why `/` is fussy.** The block menu opens only at the start of a line or after a space, so a slash inside a word — a path, a date, `abc/` — stays a slash.

**Pictures live on Cloudinary.** A pasted or dropped picture uploads straight away, and the text stores a link to it. A picture pasted into a note and later deleted, or never saved, is removed from Cloudinary by the nightly job once it is old enough that nobody can still be writing the note it was meant for. Without Cloudinary configured, pictures pasted into the editor do not upload.

## Limits

- Pictures over 15 MB are not accepted.
- With no Cloudinary configuration, pictures do not upload.

## Related

- [Learning](./learning.md) — notes are written here, including `[[wiki links]]`
- [Journal](./journal.md) — entries are written here
- [Daily log](./daily-log.md) — the win, problem, tomorrow's priority and note fields use this editor
- [Reviews](./reviews.md) — the five answers are written here
- [Habits](./habits.md) — a habit's notes use this editor
- [People](./people.md) — a person's notes, in Markdown
- [Keyboard shortcuts](../get-started/keyboard-shortcuts.md) — why `⌘B` means bold here rather than the sidebar
- [Scheduled jobs](../operations/scheduled-jobs.md) — the nightly job that clears pictures nothing refers to
- [Configuration](../operations/configuration.md) — `CLOUDINARY_*`, which picture uploads need
- [Data model: learning and knowledge](../reference/data-model/learning-and-knowledge.md) — `body_md` on notes and journal entries
