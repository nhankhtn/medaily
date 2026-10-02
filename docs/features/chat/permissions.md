---
title: Chat permissions
description: Who may do what in a chat room — what only the room's owner can do, what every member can, and how the server enforces it.
sidebar_position: 4
---

# Chat permissions

Every room has one owner: the person who made it. The owner manages the room;
everybody else in it takes part. This page lists exactly which is which.

| | |
| --- | --- |
| **Where** | Any room under `/chat` · the gear beside the room's name |
| **Works offline** | No |
| **Needs** | `MONGODB_URI` |

## Rules

- Only the person who made the room can invite, rename, change the picture, remove somebody, or delete it.
- Everybody else in the room can read, write, recall their own messages, and leave.
- Deleting a room takes the messages with it, for everyone. There is no copy.
- The rules are enforced on the server, not by hiding menu items.

| Action | Owner | Member |
| --- | --- | --- |
| Read and write messages | Yes | Yes |
| React and reply | Yes | Yes |
| Recall (and edit) their own messages | Yes | Yes |
| Recall someone else's message | No | No |
| Leave the room | Yes | Yes |
| Invite someone (**Add someone**) | Yes | No |
| Rename the room | Yes | No |
| Set, change or remove the group picture | Yes | No |
| Remove somebody from the room | Yes | No |
| Delete the room | Yes | No |

## Check whether you own a room

1. Open the room and press the gear beside its name.
2. If you see **Add someone**, **Rename the room**, **Group picture**, **Members** and **Delete the room**, you are the owner. A member sees only **Leave room**; the owner sees it too.

## How it works

**Decided on the server.** Every one of these actions is checked on the server,
not merely hidden in the menu, so a request made around the interface is
refused just the same.

**Where the rank lives.** The ranks live on the member's seat in the room
rather than on a "who made this" column, so a room that predates that column
still knows its owner.

**Deleting is for everyone.** Deleting a room takes the messages with it, for
everyone. There is no copy, and nothing asks twice beyond the confirmation.

**Recalling is your own.** You can recall your own message, and only your own —
the owner cannot recall anyone else's either. The row stays with a line saying
it was withdrawn.

## Limits

- There is one owner per room, and no way to pass ownership on.

## Related

- [Rooms and invites](./rooms-and-invites.md) — the owner-only actions, step by step
- [Messages](./messages.md) — what every member can do inside a room
- [Chat overview](./overview.md) — room kinds
- [Privacy](./privacy.md) — what the server itself can read
- [The doorbell](../../reference/realtime/doorbell.md) — why removing someone rotates the room's key and leaving does not
- [Data model: chat](../../reference/data-model/chat.md) — members and their rank
