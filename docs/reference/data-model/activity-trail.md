---
title: Activity trail
description: The MongoDB activity collection — one document per recorded action, with before and after snapshots, cursor paging and a TTL.
sidebar_position: 12
---

# Activity trail

The activity trail is a MongoDB collection with one document per recorded action, kept so you can see what changed and when, and expired after a set number of days. It is only there when `MONGODB_URI` is set; why it lives in Mongo, and why nothing there uses transactions, is in [Data model](./overview.md).

## `activity`

One document per recorded action. Scoped by `userId` like every Postgres table.

| Field | Notes |
| --- | --- |
| `userId`, `at`, `action` | `action` reads `entity.verb` — `transaction.create`, `session.login` |
| `entityId` | Which row it was about, so a trail leads back to a record |
| `label` | What a person would call it. **Never an amount, never the contents of a journal entry** — a log that quotes what it watched is a second copy of the thing it was meant to be a record *about* |
| `requestId` | Ties a row to the server console lines and the alert for one request |
| `current` | Snapshot of the row as it stood before the action. A create has none |
| `request` | Snapshot of what the action was asked to make it. A delete has none |

`_id` is the default ObjectId. The trail pages on it — `_id` is monotonic in creation time and unique, so it orders and breaks ties in one field — and the cursor handed out is that id in base64url, so nothing outside the store knows it is an ObjectId.

## Snapshots

A snapshot is a flat map of field to display string (or null), built by the domain code that knows how a person reads it — only that code can turn a `categoryId` into "Ăn uống". **A field left out is a field the trail does not follow**; that is the whole privacy control.

Both sides are stored rather than the difference between them: a difference is a reading, readings improve, and the list of changed fields is worked out when the trail is read. Rows written before snapshots existed have neither and read as empty.

## What is recorded

Per `src/lib/activity/types.ts`:

| Entity | Verbs |
| --- | --- |
| `transaction` | `create`, `update`, `delete`, `restore` |
| `account`, `category` | `create`, `update`, `delete` |
| `habit`, `person` | `create`, `update`, `delete`, `restore` |
| `goal`, `note` | `create`, `update`, `delete` |
| `daily` | `update` — in the vocabulary, but nothing writes it yet |
| `session` | `login`, `logout` |
| `chatRoom` | `create`, `rename`, `delete`, `join`, `leave`, `invite`, `remove` — who could read a room, never the messages |

Ticks, logs and timer runs are not recorded: a trail of every habit ticked would bury the entries anyone actually goes looking for. A stored action this build has no label for, written by an older deploy, is skipped on read rather than shown as a raw key.

## Indexes and expiry

Two indexes, created by `readyCollection` on first use:

| Index | On | Purpose |
| --- | --- | --- |
| `user_id_desc` | `{ userId, _id: -1 }` | The only read there is |
| `ttl` | `at` | Expires documents after `ACTIVITY_LOG_DAYS` (90 when blank) |

A log that grows forever is a liability, not an asset.

## Related

- [Data model](./overview.md) — conventions, and why MongoDB has no transactions or migrations here
- [Settings](../../features/settings.md) — where the trail is read
- [Sign in](../../get-started/sign-in.md) — `session.login` and `session.logout`
- [Transactions](../../features/finance/transactions.md) — transaction, account and category changes
- [Habits](../../features/habits.md), [Goals](../../features/goals.md), [People](../../features/people.md), [Learning](../../features/learning.md) — the other entities whose changes are recorded
- [Rooms and invites](../../features/chat/rooms-and-invites.md) — `chatRoom` events
- [Configuration](../../operations/configuration.md) — `MONGODB_URI` and `ACTIVITY_LOG_DAYS`
- [Chat](./chat.md) — the other MongoDB collections
