---
title: Chat
description: The four MongoDB chat collections, their indexes, and how a message body is stored in the clear or locked under CHAT_MESSAGE_KEY.
sidebar_position: 13
---

# Chat

Chat lives in four MongoDB collections: rooms, seats, messages and invites. This page covers their fields, the indexes that make a resend or a second direct room impossible, and how a message's words are stored — in the clear, or locked under `CHAT_MESSAGE_KEY`. Chat is only there when `MONGODB_URI` is set; why it lives in Mongo, and why nothing there uses transactions, is in [Data model](./overview.md).

## Collections

| Collection | `_id` | Fields worth knowing |
| --- | --- | --- |
| `chat_rooms` | uuid | `kind` (`direct` \| `group`), `title`, `createdBy`, `doorbellKey`, `directKey`, `avatarUrl`, `encryption` (`locked` \| `plain`, absent on older rooms), `lastMessageAt`, `createdAt` |
| `chat_members` | `roomId:userId` | `role` (`owner` \| `member`), `joinedAt`, `leftAt`, `lastReadMessageId` |
| `chat_messages` | ObjectId | `roomId`, `userId`, `kind` (`text` \| `sticker`), `body` (+ `bodyFold` in a plain room) **or** `bodyEnc`, `clientId`, `createdAt`, `deletedAt`, `reactions`, `replyToId` |
| `chat_invites` | the code | `roomId`, `createdBy`, `email`, `expiresAt`, `maxUses`, `usedCount`, `revokedAt`, `createdAt` |

`kind` is fixed when the room is made, never derived from how many people are in it. `src/lib/chat/types.ts` also declares a third kind, `challenge`, but nothing creates or reads one yet.

## Fields that are not obvious

- **`directKey`** is the two user ids in a fixed order, uniquely indexed. That index is what stops two people opening the same direct room at once and getting one each.
- **`doorbellKey`** is what the browser listens on for a nudge that something arrived. It carries no content — see [The doorbell](../realtime/doorbell.md) — and it is rotated when somebody is removed, so a person taken out of a room stops being able to hear it ring.
- **`clientId`** is decided by the browser before the first attempt and is unique per room, which is what makes a resend harmless.
- **`_id` is an ObjectId on messages** — and on the [activity trail](./activity-trail.md), for the same reason — because it sorts by creation time: `{ roomId, _id }` is the paging index, and no separate sequence column is needed. Rooms, seats and invites use ids that mean something instead. Unlike the trail, the message cursor is the hex id itself, since read receipts and recalls already name messages by it.
- **`role` on the seat is the only word on ownership.** `createdBy` on the room is nullable and predates the rank, so nothing authorises on it.
- **`reactions`** is emoji to the user ids who pressed it, kept on the message because a reaction is never read apart from the message it is on. **One reaction per person**: choosing another emoji moves theirs rather than adding a second, tapping the one already chosen takes it back, and an emoji nobody holds any more is dropped from the map rather than kept with a count of zero.
- **`replyToId`** is the hex id of the message being answered, and only the id: the quoted words are never copied in. A copy would not follow a recall, and bodies are sealed at rest, so a snippet in the clear beside them would undo that. The quote (`replyTo`, a trimmed preview) is resolved on read, one extra query per page; a quote whose message is gone resolves to null.
- **`avatarUrl`** is a group's picture as a delivery URL, the same shape as `users.image_url`. Absent on a direct room, which wears the other person's face, and removed rather than set to null when cleared.
- **`userId` goes null, the words stay**, when somebody erases their account. That is the choice this app made, and every screen that draws a message has to survive it.

## Indexes

All created by `readyCollection` on first use:

| Collection | Index | Purpose |
| --- | --- | --- |
| `chat_rooms` | `direct_uniq` — `directKey`, unique, partial on the field existing | One direct room per pair; group rooms omit the field so they are not all "the same" room |
| `chat_rooms` | `doorbell` — `doorbellKey`, unique | |
| `chat_members` | `user_rooms` — `{ userId, leftAt }` | A person's open rooms |
| `chat_members` | `room` — `roomId` | |
| `chat_messages` | `room_seq` — `{ roomId, _id }` | Paging, in both directions |
| `chat_messages` | `room_client` — `{ roomId, clientId }`, unique | What makes a resend harmless |
| `chat_messages` | `user` — `userId` | Erasing an account |
| `chat_invites` | `email` — sparse; `room` — `roomId` | |

No TTL on any chat collection. A conversation that deletes itself after a while is a bug.

## `body` and `bodyEnc`

A message's words are in one of two places. **Exactly one is ever present** — a document is not a row with a fixed set of columns, so the unused one is simply not written rather than written empty.

Which one is decided by the room's `encryption`, set when the room is made and never changed:

| Room `encryption` | `body` | `bodyFold` | `bodyEnc` |
| --- | --- | --- | --- |
| `plain` | the words | the words folded for search: lower case, no marks, `đ` → `d`, single spaces | — |
| `locked` | — | — | `{ v, iv, ct, wraps }`. With no `CHAT_MESSAGE_KEY` the write is **refused**, never stored in the clear |
| absent (`legacy`, a room made before the choice) | the words when no key is set | — | locked when a key is set |
| any, once recalled | — | — | — |

`bodyFold` exists so a plain room can be searched by the database: a `$regex`
on it, walked along `room_seq`. It is no more revealing than `body` beside it,
and it is never written next to `bodyEnc`. Editing a message rewrites it;
recalling one removes it.

A recalled message is therefore known by `deletedAt` alone, which was already the only thing that marked it. Nothing has to tell an empty message from a withdrawn one, because an empty message cannot be sent.

`ct` is the message encrypted under a key made for that message alone, which is never stored. `wraps` maps a key id — the first 8 hex of the key's SHA-256, which says *which* key without saying anything about it — to that message key wrapped under it. Two entries, one per environment key, is what lets the spare open everything the main one can.

Everything is AES-256-GCM, with `messageId:roomId` as additional authenticated data. Without that, anyone who could write to this database could lift a locked body out of one message and drop it into another and it would still open; with it, a body that has been moved no longer opens at all.

> **Important:** The key never leaves the server, so **this is not end-to-end encryption.** It defends a dump, a backup and the cluster's operator. It does not defend against someone holding the application server. Within a `locked` room, removing the key stops new messages being sent rather than letting them through in the clear. In a `legacy` room, setting a key migrates nothing and removing it strands everything written while it was set.

## Related

- [Data model](./overview.md) — conventions, and why MongoDB has no transactions or migrations here
- [Chat overview](../../features/chat/overview.md) — room kinds and unread counts
- [Rooms and invites](../../features/chat/rooms-and-invites.md) — `chat_rooms`, `chat_members` and `chat_invites`: creating, inviting, leaving, removing, group pictures
- [Messages](../../features/chat/messages.md) — `chat_messages`: sending, replies, reactions, recalls, stickers
- [Who may do what](../../features/chat/permissions.md) — `role` on the seat
- [Privacy](../../features/chat/privacy.md) — what locked messages mean for the person using chat
- [The doorbell](../realtime/doorbell.md) — how `doorbellKey` is rung and rotated
- [Typing indicator](../realtime/typing-indicator.md) — claims stored under the room's `doorbellKey`
- [Push notifications](../realtime/push-notifications.md) — what a room's notification says
- [Configuration](../../operations/configuration.md) — `MONGODB_URI` and `CHAT_MESSAGE_KEY`
- [Activity trail](./activity-trail.md) — `chatRoom` membership events are recorded there
- [Core](./core.md) — `users.image_url`, the shape `avatarUrl` follows
