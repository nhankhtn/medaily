---
title: Chat privacy
description: What the server can read of your chat messages, and how locked messages protect the database without being end-to-end.
sidebar_position: 5
---

# Chat privacy

Chat messages can be **locked before they reach the database**, so a database
dump, a stray backup or whoever runs the cluster finds nothing to read. This
page says exactly what that protects, what it does not, and what the person
running the app has to look after.

| | |
| --- | --- |
| **Where** | Server configuration; nothing to switch on in the app |
| **Works offline** | Not applicable |
| **Needs** | `CHAT_MESSAGE_KEY`, and preferably `CHAT_MESSAGE_KEY_SPARE` — see [Configuration](../../operations/configuration.md) |

## Rules

- With `CHAT_MESSAGE_KEY` set, every message is encrypted before it is written to the database.
- The server holds the key, so this is **not end-to-end** encryption.
- It protects a database dump, a stray backup, and whoever runs the database cluster. It does not protect against someone who has the application server.
- Without the key, messages are stored as plain text in Mongo.
- Switching it on migrates nothing: old plain rows and new locked rows live side by side.
- Switching it off strands everything written while it was on.
- A key added later opens nothing written before it.
- Lose the keys and the messages are gone. There is no recovery.

## Turn on locked messages

1. Make a key:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. Make a second one the same way for the spare.
3. Set `CHAT_MESSAGE_KEY` and `CHAT_MESSAGE_KEY_SPARE` on the deployment — **before the first message is written**.
4. Keep a copy of both somewhere that is not the database.
5. Redeploy or restart. From now on every new message is locked.

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

**Mixed rows.** Without the variable, messages are stored as they always were,
and rows of both kinds live together: switching it on migrates nothing, and
switching it off strands everything written while it was on.

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

## Related

- [Chat overview](./overview.md) — where messages are stored
- [Messages](./messages.md) — what is being locked
- [Permissions](./permissions.md) — who can read a room through the app
- [Notifications](../notifications.md) — a notification preview shows message words on the lock screen
- [Configuration](../../operations/configuration.md) — `CHAT_MESSAGE_KEY`, `CHAT_MESSAGE_KEY_SPARE`
- [Live updates overview](../../reference/realtime/overview.md) — what Firestore holds, and why it is not the messages
- [Data model: chat](../../reference/data-model/chat.md) — `body` and `bodyEnc` on messages
