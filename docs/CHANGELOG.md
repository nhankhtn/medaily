# Documentation changelog

What changed in `docs/`, and when. Newest first.

Dates are the day the document was written, not the day the code shipped. A
line here is the cheapest way to know whether what you are reading is older
than the code.

## 2026-10-01

**Added**

- [features.md](features.md) finally has a **Chat** section, closing the gap
  the 2026-09-30 entry below admits to. Rooms of two kinds, invites that are
  spent on first use, optimistic send, recall, reactions and stickers, who
  sits on which side, and who may do what — including that the ranks live on
  the member's seat rather than on the room's `createdBy`, so a room older
  than that column still knows its owner.
- [database.md](database.md) gained a second half: the **MongoDB collections**.
  Until now the document described 46 Postgres tables and said nothing about
  where the activity trail or any chat message actually lives. Four chat
  collections and `activity`, their indexes, and why there are no transactions
  in any of it.
- **Locked messages.** `CHAT_MESSAGE_KEY` and `CHAT_MESSAGE_KEY_SPARE`, written
  up in both documents, because this is the one feature where getting it wrong
  destroys data rather than breaking a screen. Each message is encrypted under
  a key of its own; that key is wrapped once per environment key, which is how
  a spare opens everything the main one can. Both documents say plainly that
  the server holds the key and this is **not** end-to-end, and that a key added
  after the first message opens nothing written before it.
- Unread counts: the badge on the nav, the per-room number, why your own
  messages never count, and why the mark follows the newest message that has
  landed rather than the newest one drawn.
- Budgets: the monthly total, moving back through past months, setting a
  budget on a month already gone, and the copy into each new month on the
  first night of it.
- Opening your bank's own app from a transfer, with the phone-only and
  both-banks-known conditions that decide whether the button is there at all.
- `⌘B` folds the sidebar — the one shortcut that still fires while typing, and
  why it is held off in the markdown editor.
- The markdown editor's `/` menu and its `?` panel.
- **What changed** narrowed to money and the door, in both
  [features.md](features.md) and [database.md](database.md).
- [README.md](README.md) now tells you to update the Mongo half of
  `database.md` when a collection's shape moves. Those collections have no
  migration file to force the issue.

## 2026-09-30

**Added**

- [realtime.md](realtime.md) — a fourth document. How a message reaches
  another screen, why the doorbell carries no payload, and why the typing
  indicator is the one exception. It exists because the reasoning behind
  `firestore.rules` lived only in code comments, and rules that deny fail
  silently: there is no error anywhere, updates simply never arrive.
- A typing indicator in a chat room. `Speaker` now carries `firebaseUid`
  (`auth_identities.provider_uid` where the provider is `google`) so that
  Firestore can vouch for who is typing instead of the payload claiming it —
  the rules tie a write to `request.auth.uid`. Anybody signed in with the
  password has no uid and never appears as typing, which matches their having
  no live updates at all.
- `firestore.rules` gained `channels/{channel}/typing/{uid}`, with `delete`
  separated from `create, update` because `request.resource` is null on a
  delete. No migration: the uid was already stored.
- A nightly sweep of orphaned doorbell documents, last in `/api/cron/nightly`.
  It had to be server-side: after `rotateDoorbell` nobody holds the old key,
  and the rules require it, so no browser can reach that document even to
  delete it. Typing claims go after an hour, channels after thirty days, and
  claims under a dying channel go with it — sub-collections outlive the
  document above them, so order matters.
- `FIREBASE_SERVICE_ACCOUNT`, and [realtime.md](realtime.md) says plainly what
  it costs: it is the only Firebase credential here with real power, where
  everything else runs on public keys and rules. Contained to one file that
  speaks the REST API rather than pulling in the Admin SDK, reachable only from
  the nightly job, and refused outright when its `project_id` does not match
  the project the browser signs in to.

**Known gap** *(closed 2026-10-01)*

- `features.md` still has no chat section at all — it predates this change and
  was not filled in here. Rooms, invites, recall and now the typing indicator
  are undocumented as features.

## 2026-09-21

**Added**

- Adding a transaction works offline. Held in its own IndexedDB queue and sent
  on the next connection, like the daily log — but only after the insert was
  made idempotent: the browser decides the id before the first attempt and the
  insert does nothing when that row is already there. Without it a retry
  duplicates money. No migration; `transactions.id` was already a uuid key.
- Queued transactions are drawn above the ledger from the store, not from
  React state. The form's optimistic row is `useOptimistic`, which resets when
  the action settles, so a queued transaction would have blinked out while the
  server had no record of it either.
- Editing and deleting are still online-only, and `features.md` says why: they
  need a rule for which of two changes wins, and adding does not.

## 2026-09-18

**Added**

- The daily log works with no signal. A service worker keeps a copy of the
  page, and a save the network will not carry is held in IndexedDB — behind a
  `PendingStore` interface, so the queue's rules do not know what they are
  written to — and sent on the next connection. Documented under *Daily log →
  With no signal*, including why this module and not the others: the write
  upserts on `(user_id, log_date)`, so replaying it is harmless. A new
  transaction has no such key and would duplicate, which is why finance was
  left out.
- Signing out now clears everything of a person's the device holds: the cached
  page, any unsent day, and the unsaved drafts. The page is rendered personal
  data, an unsent day would be delivered into the next account, and a draft
  would be restored into the next person's form — the restore only asks
  whether it differs from the server's values and cannot know whose it was.
  The drafts predate the offline work and were never cleared.

## 2026-09-16

**Added**

- Goals can be dragged into an order of your own (`0014` adds
  `goals.sort_order`). Documented in `features.md` under Goals and in the
  schema table.

## 2026-09-15

**Added**

- Wiki links are links. `[[Another note]]` rendered as bold brackets and a
  note could not be opened from the Knowledge page at all, so **Linked from**
  was reachable only by search or a pasted URL — the whole feature was
  invisible while working correctly underneath. Note titles now open the note,
  and a resolved link is a real link.
- A note can be filed under a topic and against a book or course. The columns
  `notes.topic_id` and `notes.resource_id` have existed since `0001` but were
  reachable only by seeding or import — no screen wrote them and none showed
  them. Both pickers now sit in the note form, and the card shows what a note
  is filed under. No migration: the columns were already there.
- Crash alerts to Telegram, off unless `TELEGRAM_BOT_TOKEN` and
  `TELEGRAM_CHAT_ID` are set. Written up in the README rather than in
  `features.md`: it is a deployment concern, not something a person using the
  app can see.
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
