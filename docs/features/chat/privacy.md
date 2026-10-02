---
title: Chat privacy
description: What the server can read of your chat messages, and how locked messages protect the database without being end-to-end.
sidebar_position: 5
---

# Chat privacy

Chat messages can be **locked before they reach the database**, so a database
dump, a stray backup or whoever runs the cluster finds nothing to read. Whether
a group is locked is **chosen when it is created and cannot be changed**. This
page says exactly what that protects, what it costs, and what the person
running the app has to look after.

| | |
| --- | --- |
| **Where** | **Encrypt messages** in the **New room** dialog · shown in **Room settings** · needs a key on the server |
| **Works offline** | Not applicable |
| **Needs** | `CHAT_MESSAGE_KEY`, and preferably `CHAT_MESSAGE_KEY_SPARE` — see [Configuration](../../operations/configuration.md) |

## Rules

- Each group room is **encrypted or not**, decided once with **Encrypt messages** when it is created. It is off by default, and nothing can change it afterwards.
- **Encrypt messages** can only be ticked when the server has `CHAT_MESSAGE_KEY` set.
- In an encrypted room every message is encrypted before it is written to the database. If the key is later removed, the room refuses new messages rather than storing them in the clear.
- In a room that is not encrypted, messages are stored as plain text, even when the server has a key.
- The trade-off is search: a room that is not encrypted is searched by the database, quickly and all the way back. An encrypted room has to be opened a page at a time, so its search is slower and looks back 1,000 messages per try.
- **Room settings** shows which kind a room is: **Messages are encrypted** or **Messages are not encrypted**.
- Direct conversations follow the server: encrypted when it has a key.
- Rooms made before this choice existed keep the old behaviour: encrypted when the server had a key at the time each message was written.
- The server holds the key, so this is **not end-to-end** encryption.
- It protects a database dump, a stray backup, and whoever runs the database cluster. It does not protect against someone who has the application server.
- A key added later opens nothing written before it.
- Lose the keys and the messages are gone. There is no recovery.

## Create an encrypted room

1. Open **Chat** and press **New room**.
2. Name the room, then tick **Encrypt messages**. Read the note under it: search is slower and you cannot change this later.
3. Press **Create**.

If **Encrypt messages** cannot be ticked, the server has no key yet — see the next section.

## Set up the key on the server

1. Make a key:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. Make a second one the same way for the spare.
3. Set `CHAT_MESSAGE_KEY` and `CHAT_MESSAGE_KEY_SPARE` on the deployment — **before the first message is written**.
4. Keep a copy of both somewhere that is not the database.
5. Redeploy or restart. **Encrypt messages** can now be ticked when creating a room.

## Keep a way back in

1. Set `CHAT_MESSAGE_KEY_SPARE` alongside the main key. It is a second key that opens everything the first one does.
2. If the main key is lost, the spare is the way back in.
3. When the main key is rotated, the spare is the way through: messages wrapped for it stay readable.

## How it works

**A key per message.** Each message is encrypted under a key of its own, which
is then wrapped once per key in the environment — which is how a spare key
opens everything the main one can.

**What this is, and is not.** The server holds the key, so this is not
end-to-end. It protects a database dump, a stray backup, and whoever runs the
cluster. It does not protect against someone who has the application server.
Telegram's group chats make exactly this trade, and for the same reason — a
conversation you can read on a new device is a conversation the server can read
too.

**Why the choice is per room, and final.** Encryption costs search speed, so
it is worth having only where the conversation needs it. Deciding it once,
before the first message, means a room is never half one kind and half the
other, and everyone who joins joins a room whose terms were set at the start.
A switch that could be flipped later would let the owner turn other people's
messages into plain text without asking them.

**How search differs.** In a room that is not encrypted, each message is also
stored folded (lower case, without marks) and the database matches on that, so
search covers the whole room in one go. An encrypted room has nothing the
database can match, so the app opens messages a page at a time — up to 1,000
per search, with **Look further back** for more.

**No recovery.** Lose the keys and the messages are gone. Keep a copy somewhere
that is not the database, and set both keys *before* the first message — a key
added later opens nothing written before it.

**What else holds chat data.** Firestore, used for live updates, holds no
message text — one document per room with a counter and a time. See
[Live updates overview](../../reference/realtime/overview.md).

## Limits

- Not end-to-end: anyone with the application server can read messages.
- No key recovery.
- Existing plain-text messages are never encrypted after the fact.
- A room's encryption cannot be changed, in either direction.
- Search in an encrypted room is slower and looks back 1,000 messages per try.

## Related

- [Chat overview](./overview.md) — where messages are stored
- [Messages](./messages.md) — what is being locked
- [Permissions](./permissions.md) — who can read a room through the app
- [Notifications](../notifications.md) — a notification preview shows message words on the lock screen
- [Configuration](../../operations/configuration.md) — `CHAT_MESSAGE_KEY`, `CHAT_MESSAGE_KEY_SPARE`
- [Live updates overview](../../reference/realtime/overview.md) — what Firestore holds, and why it is not the messages
- [Data model: chat](../../reference/data-model/chat.md) — `body` and `bodyEnc` on messages
