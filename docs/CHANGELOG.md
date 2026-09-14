# Documentation changelog

What changed in `docs/`, and when. Newest first.

Dates are the day the document was written, not the day the code shipped. A
line here is the cheapest way to know whether what you are reading is older
than the code.

## 2026-09-15

**Changed**

- `features.md` — the Today page is gone; its content is now the Calendar's
  **Day** view, which the Calendar opens on. Rewrote the section and the table
  of what shows on a day.
- Undated tasks no longer appear on every day's to-do list. They sit on a
  separate **Not on a day yet** card, with a button that puts one on the day
  being viewed.

## 2026-09-14

First version, describing the app as of migration `0012_standalone_tasks`.

**Added**

- `database.md` — 46 tables with their columns, the conventions that repeat
  across all of them, and an ER diagram of the core relationships. Written
  from the live schema rather than from the Drizzle files, so generated
  columns and defaults are as Postgres actually holds them.
- `features.md` — every module, how to use it, and the two ideas that explain
  the design: the daily log records the past and plans live elsewhere; a fact
  is entered once.
- `README.md` — which document answers which question, and the rule for
  keeping them from drifting.

**Worth knowing about this snapshot**

- Custom metrics and the Today page were added the same day and are described
  here from the start.
- `project_tasks.project_id` became nullable in `0012`, which is what makes a
  task with no project possible.
- `user_settings.shortcuts` arrived in `0011`; only keys that differ from the
  registry are stored.
