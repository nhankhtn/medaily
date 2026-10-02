---
title: Messages
description: Send messages, emoji and stickers, reply with a quote, react, recall your own messages, and see who is typing.
sidebar_position: 3
---

# Messages

Inside a room you write, react, reply, edit and take things back. Everything
you can do to a message sits in one menu you open from the message itself, and
the layout tells you who said what without a name on every line.

| | |
| --- | --- |
| **Where** | `/chat/<room>` |
| **Works offline** | No |
| **Needs** | `MONGODB_URI`. Live arrival and the typing indicator need live updates — see [Configuration](../../operations/configuration.md) |

## Rules

- Your own message appears the moment you send it and settles in place when the server agrees.
- A message that is nothing but emoji is drawn large.
- Fifty messages load at a time; older ones arrive as you scroll up.
- There are six reactions, and one reaction per person per message: choosing another moves yours.
- You can recall your own messages, and only your own.
- A recalled message stays in the conversation as a line saying it was withdrawn, and has no menu or button at all.
- A reply carries a quote of the message it answers; if that message is later recalled, the quote says so too.
- Messages from one person within five minutes of each other, on the same day, stack into a run.
- Your messages sit on the right, everyone else's on the left.
- Sending too fast is refused for a moment — about thirty messages a minute — with *Slow down a moment, then send it again.*

## Send a message

1. Type in the box at the bottom of the room.
2. Optionally open the emoji or sticker picker beside the box.
3. Send. Your message appears straight away and settles in place when the server has it. If it could not be sent, it says **Not sent. Try again.**

## Open a message's menu

- **On a phone:** press and hold the message.
- **On a computer:** right-click the message.

The menu has the six reactions along the top, then **Reply**, **Copy** (for a
message with words in it), **Edit** and **Recall** (on your own messages only).
A recalled message, or one still being sent, has no menu.

## React to a message

1. Open the message's menu, or on a computer hover the message and press the **smiley** beside it, which offers the reactions alone.
2. Pick one of the six reactions.
3. To change it, pick another; yours moves rather than adding a second.
4. To take it back, tap your reaction under the words.

## Reply to a message

1. Open the message's menu and choose **Reply**.
2. The message you are answering shows above the box. Press **Cancel reply** to drop it.
3. Type and send. The reply carries a quote of the original.

## Copy a message

1. Open the message's menu and choose **Copy**. A sticker has no words to copy, so it has no **Copy**.

## Recall a message

1. Open the menu on one of your own messages and choose **Recall**.
2. The row stays, with a line saying the message was withdrawn.

## Edit a message

1. Open the menu on one of your own text messages and choose **Edit**.
2. Change the words and send, or press **Stop editing**.
3. The message is marked **edited** beside its time. It keeps its place, and a reply quoting it goes on quoting it.

Recalled messages and stickers cannot be edited.

## Search a room

1. Open **Search** in the room and type a word from the message.
2. Pick a result to jump to it, shown with the messages around it. **Look further back** searches older stretches of the room.
   - In a room that is not encrypted, search covers the whole room at once.
   - In an encrypted room, the box says so: each try looks back 1,000 messages and is slower. See [Chat privacy](./privacy.md).
3. Press **Back to the latest** to return to the end of the conversation.

## Nudge the room

1. Press **Nudge**.
2. Everyone else in the room who has notifications on gets *Your name nudged you* on their device. Nothing is added to the conversation.

Up to three nudges per room in a row, refilling over five minutes; past that
it says **Give them a moment first.**

## How it works

**Sending.** Your own message appears the moment you send it, not when the
server agrees, and settles in place when it does. Emoji and stickers sit beside
the box; a message that is nothing but emoji is drawn large, the way every chat
app has trained people to expect. Fifty messages load at a time and older ones
arrive as you scroll up.

**Where the actions are.** The message is what is being acted on, so the
message is what you reach for: press and hold on a phone, right-click on a
pointer. The menu puts the reactions above everything else, because reacting is
the common answer and a menu that opened on **Reply** buried it. On a computer a
**smiley** beside the message also appears when you hover it, offering the
reactions alone — a row of icons under every line was louder than the
conversation. On a phone that button is gone: press and hold opens the faces
along with everything else, and a button beside every line cost a thumb's width
of every message.

> **Note:** An earlier layout had one **smiley** button beside every message,
> always shown on a phone, opening a panel with the reactions, **Reply** and
> **Recall**. Those actions, with **Copy** and **Edit**, now live in the
> press-and-hold / right-click menu.

**Taking it back.** You can recall your own message, and only your own. The row
stays with a line saying it was withdrawn — the conversation is never rewritten
to look like something was not said.

**Who is where.** Your messages sit on the right, everyone else's on the left.
Messages one person sends within five minutes of each other, on the same day,
stack into a run: the name is written once, inside the first bubble, and the
face sits beside the last. The side says who, which is why a name is only drawn
on other people's. A line with the date separates one day from the next, and
each bubble carries its time in the corner.

**Typing.** When someone is typing, you see it — the one live signal that
carries any content at all. See
[Typing indicator](../../reference/realtime/typing-indicator.md) for why it
cannot lie about who.

**Editing is the same message, late.** An edit is checked the same way as
sending and the room is told the same way, but it is not a second message: the
id does not change, so an answer that quotes it goes on quoting it, and nothing
that was read moves.

**A nudge carries nothing.** Every other notification is about something that
happened; a nudge is the thing itself, so it has no words and leaves no line in
the room. The limit is per room, so being quiet in one conversation is not the
price of having been playful in another.

## Limits

- Only your own messages can be recalled or edited.
- No message can be deleted outright; recalling leaves a line in its place.
- One reaction per person per message, from a fixed set of six.

## Related

- [Chat overview](./overview.md) — rooms and unread counts
- [Rooms and invites](./rooms-and-invites.md) — getting people into the room
- [Permissions](./permissions.md) — what every member may do, and what only the owner may
- [Privacy](./privacy.md) — whether the words are locked before they are stored
- [Notifications](../notifications.md) — a message, or a nudge, reaching a phone that is face down
- [Typing indicator](../../reference/realtime/typing-indicator.md) — how "is typing" works
- [The doorbell](../../reference/realtime/doorbell.md) — how a new message arrives without a reload
- [Data model: chat](../../reference/data-model/chat.md) — the messages collection
