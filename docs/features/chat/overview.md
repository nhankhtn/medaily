---
title: Chat overview
description: Talk with the other people who use this instance, in direct rooms or named group rooms.
sidebar_position: 1
---

# Chat overview

Chat is for conversations with the other people who use this instance. It is a
side room, not a product: the app is a personal log, and chat exists because
some of what you track is arranged with somebody else.

| | |
| --- | --- |
| **Where** | `/chat` · sidebar → Life · a room is `/chat/<room>`, an invite is `/chat/join/<code>` |
| **Works offline** | No |
| **Needs** | `MONGODB_URI` — without it Chat still appears in the nav, but its pages answer 404. Optional: `CHAT_MESSAGE_KEY` (locked messages), `NEXT_PUBLIC_REALTIME_ENABLED` (live updates), `CLOUDINARY_*` (group pictures), push keys (notifications) — see [Configuration](../../operations/configuration.md) |

## Rules

- There are two kinds of room: direct and group.
- A direct room is between two people, and there is only ever one per pair; opening it again finds the first.
- A group room has a name and as many people as are invited.
- Only the room's owner — the person who made it — can invite, rename, change the picture, remove somebody or delete the room.
- The nav shows how many rooms have something unread; the room list shows how many unread messages each room holds.
- Your own messages never count as unread.
- Opening a room marks it read up to the newest message that has actually landed.
- Chat needs the second database (`MONGODB_URI`); without it its pages answer 404.

## Open a conversation

1. Open **Chat** from the sidebar.
2. Pick a room from the list. Rooms with something unread show how many messages are waiting.
3. Read and reply — see [Messages](./messages.md).

To start a group room or bring someone in, see
[Rooms and invites](./rooms-and-invites.md).

## How it works

**Two kinds of room.** A direct room is between two people and there can only
ever be one of them — opening a conversation twice finds the first rather than
making a second. A group room has a name and as many people as you invite.

**What is waiting.** The nav carries how many rooms have something unread, and
the list says how many messages each one holds — a room list that looks the
same whether or not anybody wrote to you is one you have to open to use. Your
own messages never count: sending something is not a reason for a room to ask
to be read. Opening a room marks it read from the newest message that has
actually landed, so a bubble still in flight cannot move the mark past
something you have not seen.

**New messages without a reload.** With live updates configured, a room and the
unread badge hear new messages as they arrive; without them, chat checks again
on a slow timer. See [Live updates overview](../../reference/realtime/overview.md).

**Where it is stored.** Rooms, members, invites and messages live in MongoDB,
not Postgres — the same second database that holds the activity trail. Message
text can be locked before it is written; see [Privacy](./privacy.md).

## Limits

- Chat is only between people who use this instance; there is no way to reach anyone outside it.
- No offline use.

## Related

- [Rooms and invites](./rooms-and-invites.md) — creating rooms, invite links, leaving, removing and deleting
- [Messages](./messages.md) — sending, runs, replies, reactions and recalling
- [Permissions](./permissions.md) — who may do what in a room
- [Privacy](./privacy.md) — what the server can read, and locked messages
- [Notifications](../notifications.md) — a message reaching a phone that is face down
- [Live updates overview](../../reference/realtime/overview.md) — how new messages arrive without a reload
- [The doorbell](../../reference/realtime/doorbell.md) — the signal behind the unread badge
- [Typing indicator](../../reference/realtime/typing-indicator.md) — seeing that someone is typing
- [Configuration](../../operations/configuration.md) — `MONGODB_URI` and the optional chat variables
- [Data model: chat](../../reference/data-model/chat.md) — the Mongo collections behind chat
