---
title: The doorbell
description: How a content-free Firestore ring tells other screens to fetch new chat messages, what rings it, and how the unread badge listens too.
sidebar_position: 2
---

# The doorbell

The doorbell is a tiny Firestore write that tells everyone else in a room to go and ask the server for new messages. It carries no content, it is edge-triggered, and its channel is a separate key that is rotated when somebody is removed. When it fails, the 45-second floor described in [Live updates](./overview.md) covers for it.

## From send to screen

```text
you send "hello"
  │
  ├─ the row appears on your screen at once, under a client id
  ├─ stop()                  → retract your typing claim (before the request)
  ├─ sendMessage(...)        → the text goes to MongoDB; the stored row
  │                            replaces the placeholder
  └─ ringRoom(doorbellKey)   → only after it is saved: one tiny write to
                               Firestore: { seq: +1, at }
                                     │
                                     ▼
                        their onSnapshot fires  (~0.1–0.3s)
                                     │
                        debounce 400ms  (one ask covers a burst)
                                     │
                        catchUp():
                          loadNewMessages, page after page while `more`
                          then loadRecentMessages, to refresh rows already shown
                                     │
                        "hello" appears — fetched from MongoDB, never Firestore
```

The order is deliberate at both ends. The claim is retracted **before** the request, because the name should go the moment the words do, not a round trip later. The ring goes **after** the save, so nobody is sent looking for a message that is not there yet.

`catchUp` keeps paging while the server says there is more: stopping at the first page would move the cursor past messages that were never shown, leaving a hole nothing goes back for. Paging forward only brings rows that did not exist before, so it then reloads the most recent page and swaps in any row that changed — otherwise a recall or a reaction on a message already on screen would never reach anyone else.

## What rings

Sending is not the only thing that rings. **Toggling a reaction and recalling a message ring the doorbell too** — `toggleReaction` returns the room's `doorbellKey` for it, and a recall rings the key the room was opened with. Without the ring, a recalled message would stay readable on other screens until the floor came round.

## Three deliberate properties

Each one is load-bearing.

**The signal carries nothing.** Firestore holds a counter and a time. The text lives in MongoDB and is fetched from the server, which is the only party that knows who may see what. A ring means "ask", never "here is what changed".

**A ring is edge-triggered.** Nothing compares `seq` against what it was. A payload is attacker-writable, and a client that gated on a counter could be deafened for good by one absurdly large number. The one snapshot that is ignored is a local echo — `metadata.hasPendingWrites` — which is this tab's own ring before the server has seen it, not news from anyone else.

**The channel is not the room id.** `doorbellKey` is a separate uuid, rotated by `rotateDoorbell` when somebody is removed from a room. Losing access means losing the ability to listen, without changing anything the room is keyed by.

## Leaving is not removal

Only `removeMember` rotates the key. **`leaveRoom` does not**, and neither does erasing an account. Somebody who leaves a room on their own keeps a working copy of its key: they can no longer read a message — that is the server's call, and it says no — but they can still hear the doorbell ring, which tells them when the room is busy, and still list its typing claims, which tells them which Firebase uids are active in it. This is a known gap, not a decision.

A rotation also orphans the old channel document in Firestore; the nightly sweep cleans those up — see [Housekeeping](./housekeeping.md).

## The unread badge listens too

The room is not the only listener. `UnreadWatch` (`src/features/chat/unread-watch.tsx`) is mounted once in `src/app/(app)/layout.tsx` and listens to the doorbell of **every** room the person is in — the keys come from `unreadForShell`, out of the same read of the room list that produces the badge count.

| | The room | The badge |
| --- | --- | --- |
| Listens to | one room's key | every room's key |
| On a ring | `catchUp()` | `router.refresh()` |
| Settles for | 400ms (`DEBOUNCE_MS`) | 800ms (`SETTLE_MS`) — several rooms can ring at once |
| Floor | 45s (`FLOOR_MS`) | 60s (its own `FLOOR_MS`) |
| On the tab becoming visible | asks | refreshes |

Why every room's key rather than one channel per person: somebody would have to ring a per-person channel, and the only client that knows a message was sent is the sender's — which would then need everybody else's key. A key other people hold is not a key. Listening to the rooms costs no extra writes, because these are the channels the rooms already ring. Counting stays the server's job; a ring only asks the layout to render again.

## Related

- [Live updates](./overview.md) — the two paths and the 45-second floor
- [Typing indicator](./typing-indicator.md) — claims stored under the same channel key
- [Setup](./setup.md) — turning the doorbell on, and why a refused doorbell listener is still silent in the console
- [Housekeeping](./housekeeping.md) — sweeping channels orphaned by deletion and rotation
- [Messages](../../features/chat/messages.md) — sending, reactions and recalls, each of which rings
- [Rooms and invites](../../features/chat/rooms-and-invites.md) — leaving vs being removed
- [Chat overview](../../features/chat/overview.md) — unread counts and the badge
- [Privacy](../../features/chat/privacy.md) — what the server and Firestore can read
- [Chat data model](../data-model/chat.md) — `doorbellKey` on `chat_rooms` and its unique index
