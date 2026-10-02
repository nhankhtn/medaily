---
title: Learning and knowledge
description: Topics, resources, notes, wiki links, tags and journal entries, and the diacritic-folding full-text search behind them.
sidebar_position: 6
---

# Learning and knowledge

These tables hold what you study and what you write down about it: one hierarchy of topics, the books and courses you work through, notes with wiki links and tags, and the journal. Notes and journal entries carry a search vector that matches Vietnamese with or without diacritics. Shared columns are described in [Data model](./overview.md).

## Tables

| Table | Columns worth knowing |
| --- | --- |
| `topics` | `name`, `category`, `parent_id` (one hierarchy for study subjects; **no foreign key** — the tree is kept by the application) |
| `resources` | `type` (`book`, `course`, `article`, `video`, `other`), `title`, `author`, `url`, `status` (`backlog`, `in_progress`, `done`, `dropped`), `progress_percent` (0–100), `rating` (1–5), `topic_id`, `started_at`/`finished_at` (dates) |
| `notes` | `title` (not null), `body_md` Markdown, `type` (`note`, `concept`, `bookmark`, `lesson`), `url` (for a bookmark), `topic_id`, `resource_id`, `learned_on` (the day a lesson was learned, not typed), `search_tsv` |
| `note_links` | `source_note_id` → `target_note_id`, plus `target_title` so a `[[wiki link]]` to a note that does not exist yet is kept, not dropped. Primary key is `(source_note_id, target_title)` — no `id`. `target_note_id` is nullable and `ON DELETE CASCADE`, like the source |
| `tags` / `note_tags` | Free-form tags, `name` unique per user. `note_tags` is keyed `(note_id, tag_id)`. A lesson's **place** — home, office — is a tag, not a column, because places change and a tag costs no migration |
| `journal_entries` | `entry_date`, `title` (optional), `body_md`, `mood`, `tags` (a text array, not `note_tags`), `search_tsv`. Many per day — distinct from `daily_logs.note`, the one quick line inside the day's log |

Topics are also what focus sessions, planned blocks and skills point at — see [Work and time](./work-and-time.md) and [Career](./career.md).

## Search: `search_tsv`

`search_tsv` is maintained by a trigger (see `drizzle/views.sql`) rather than a generated column, because the diacritic-folding function has to exist before the column that uses it — and migrations run before that SQL.

The vector is `title` weighted `A` plus `body_md` weighted `B`, under the `simple` configuration and an `unaccent` wrapper, so a Vietnamese word matches with or without its diacritics.

## Related

- [Data model](./overview.md) — conventions shared by every table, and how `drizzle/views.sql` is applied
- [Learning](../../features/learning.md) — topics, resources, notes, note types, links and tags
- [Writing in the editor](../../features/editor.md) — writes the `body_md` that notes and journal entries store
- [Journal](../../features/journal.md) — reads and writes `journal_entries`
- [Daily log](../../features/daily-log.md) — `daily_logs.note`, the one quick line that is not a journal entry
- [Timer](../../features/timer.md) — learning sessions attributed to a topic
- [Career](../../features/career.md) — a skill can point at a topic
- [Work and time](./work-and-time.md) — `focus_sessions.topic_id` and `planned_blocks.topic_id`
- [Career](./career.md) — `skills.topic_id`
