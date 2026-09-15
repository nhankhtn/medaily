# Documentation changelog

What changed in `docs/`, and when. Newest first.

Dates are the day the document was written, not the day the code shipped. A
line here is the cheapest way to know whether what you are reading is older
than the code.

## 2026-09-15

**Added**

- Quick capture reads a paragraph of intentions and splits it into goals and
  to-dos. Documented under *Getting around*, with the rule that decides which
  is which and what leaves the machine.
- The goal form can be filled from a sentence, with the same draft-then-confirm
  shape finance capture uses.
- Topics can finally be created. The action existed since the first release but
  nothing called it, so the topic picker on the timer was always empty. A
  **Manage** button on *Time by topic* now adds, renames and archives them.
- A fifth custom-metric kind, `duration`, measured in minutes (`0013`). The
  timer can run one, which is how an activity the app never heard of gets
  timed rather than typed.

**Changed**

- `features.md` — the `/search` page is gone; the command palette is now the
  search, over every text-bearing module. The features doc was updated with
  that commit but the changelog line was missed, so it is recorded here.
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
