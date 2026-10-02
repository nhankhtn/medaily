---
title: Rooms and invites
description: Create a group room, bring people in with a one-time invite link, and leave, remove people from or delete a room.
sidebar_position: 2
---

# Rooms and invites

A group room is a named conversation with as many people as you invite. You
bring someone in with an invite link; the person who made the room manages who
is in it, what it is called and what picture it shows.

| | |
| --- | --- |
| **Where** | `/chat` → **New room** · the gear beside a room's name (**Room settings**) · invite links are `/chat/join/<code>` |
| **Works offline** | No |
| **Needs** | `MONGODB_URI`. A group picture also needs `CLOUDINARY_*` — see [Configuration](../../operations/configuration.md) |

## Rules

- Only the room's owner can invite, rename, change the picture, remove somebody or delete the room. Everyone can leave.
- An invite link is good for 48 hours and for **one** person; it is spent the moment it is used.
- Opening an invite link does not spend it; only pressing **Join the room** does.
- Someone already in the room is offered **Open the room** instead of joining.
- Nothing is ever emailed by the app; you pass the link on yourself.
- Leaving a room stops you seeing it; what you wrote stays.
- Deleting a room deletes its messages for everyone. There is no copy.
- A group picture must be an image under 5 MB.
- Whether a group is encrypted is chosen when it is created, off by default, and can never be changed — see [Chat privacy](./privacy.md).

## Create a group room

1. Open **Chat** and press **New room**.
2. Answer **What is this room about?** with the room's name.
3. Optionally tick **Encrypt messages**. This cannot be changed later, and makes search slower — see [Chat privacy](./privacy.md).
4. Press **Create**. You are the room's owner.

## Invite someone

1. Open the room and press the gear beside its name.
2. Choose **Add someone**.
3. Press **Copy invite link**. The link is copied, and the toast shows it too — if the browser refused the clipboard, copy it from there.
4. Send the link to the person yourself, by any chat app or message. It works once, within 48 hours.

## Join a room from an invite

1. Open the link you were sent (`/chat/join/<code>`).
2. You land on the room list, with a dialog naming the room you were asked into.
3. Press **Join the room**, or **Not now** to leave the invite unspent.
4. If you are already in the room, the dialog offers **Open the room** instead.
5. If the link has expired or been used, the dialog says the invite no longer works — ask for a new one.

## Rename a room

1. Press the gear beside the room's name.
2. Choose **Rename the room**, type the new name and save.

## Set the group picture

1. Press the gear beside the room's name and choose **Group picture**.
2. Pick an image under 5 MB, or choose **Change the picture** to replace the current one, or **Remove the picture**.

Without Cloudinary configured, the dialog says pictures are not set up on this app.

## Remove someone from a room

1. Press the gear and choose **Members**.
2. Press **Remove from the room** beside the person and confirm.

## Leave a room

1. Press the gear and choose **Leave room**.
2. Confirm. You stop seeing the room, and what you wrote stays.

## Delete a room

1. Press the gear and choose **Delete the room**.
2. Confirm. Everyone loses the messages in it.

## How it works

**Why a link is single-use.** A link is good for 48 hours and for one person:
it is a credential, so it is spent the moment it is used.

**Why the link opens a dialog, not a page.** Opening an invite link lands on the
room list with a dialog naming the room you were asked into, rather than a page
of its own — you are being asked a question, not sent somewhere. Naming the room
does not spend the code; only **Join the room** does. That matters because a
link pasted into a chat app is fetched by its preview bot before anyone clicks
it.

**Nothing is emailed.** No mail leaves this app. Passing the link along is up to
you.

> **Note:** Earlier versions also offered an email address field under **Add
> someone**: the address was written down, and the next time somebody signed in
> with it within 48 hours they were seated in the room — even if they had no
> account yet when invited. The field never said whether the address had an
> account, deliberately, because a form that says "no such person" tells you
> who is here. It was removed because it read as sending an invitation and sent
> nothing. Sign-in still seats anyone holding an address invite, and a link
> written for an address still only works for that address, until the last such
> invite has expired.

**Leaving is not removal.** Leaving is something you do; removal is something
the owner does to you. The difference matters to the live-update channel, which
is rotated on removal but not on leaving — see
[The doorbell](../../reference/realtime/doorbell.md).

**Deleting is final.** Deleting a room takes the messages with it, for everyone.
There is no copy, and nothing asks twice beyond the confirmation.

## Limits

- An invite link cannot be reused; each person needs their own.
- A deleted room cannot be recovered.
- There is no way to hand ownership of a room to someone else.

## Related

- [Chat overview](./overview.md) — room kinds and unread counts
- [Permissions](./permissions.md) — why only the owner sees most of these menu items, and how the server enforces it
- [Messages](./messages.md) — what happens inside a room
- [Sign in](../../get-started/sign-in.md) — signing in is when an address invite seated somebody
- [The doorbell](../../reference/realtime/doorbell.md) — leaving versus removal, and the key a removal rotates
- [Housekeeping](../../reference/realtime/housekeeping.md) — what a deleted room leaves behind and the nightly sweep that clears it
- [Configuration](../../operations/configuration.md) — `MONGODB_URI`, `CLOUDINARY_*`
- [Data model: chat](../../reference/data-model/chat.md) — rooms, members and invites
