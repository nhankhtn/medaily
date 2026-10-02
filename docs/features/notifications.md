---
title: Notifications
description: Get a notification on each of your devices when someone messages you, and at 8 in the evening if the day has nothing logged.
sidebar_position: 19
---

# Notifications

Notifications reach a phone that is face down. They tell you when somebody
sends you a chat message, and remind you once in the evening if the day still
has nothing logged. Each device is turned on separately.

| | |
| --- | --- |
| **Where** | `/settings` → **Notifications** · a one-time offer after you arrive |
| **Works offline** | No — notifications arrive over the network |
| **Needs** | `NEXT_PUBLIC_FIREBASE_VAPID_KEY`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` and `FIREBASE_SERVICE_ACCOUNT`; the evening reminder also needs `CRON_SECRET` — see [Configuration](../operations/configuration.md) |

## Rules

- Notifications are turned on per device (per browser), not per account: a phone and a laptop are asked separately.
- On iPhone and iPad, notifications reach only an app added to the Home Screen — not a Safari tab, and not Chrome.
- Turning notifications off in the app stops them for that device, even though the browser keeps its permission.
- Signing out stops notifications on that device.
- A chat message notifies everyone else in the room who has notifications on; never the sender, and never someone who has left.
- One room is one line on the lock screen, however many messages arrive.
- The evening reminder, **Nothing logged today**, goes only to people whose day has no daily log **and** no transaction dated on it.
- There is no separate switch for the evening reminder: a device with notifications on gets it, a device with them off does not.
- If the server is not configured for notifications, the card does not appear and chat works exactly as before.

## Turn on notifications for this device

1. Open **Settings** and find the **Notifications** card.
2. Press **Turn on for this device**.
3. Allow notifications when the browser asks.
4. A toast says **Notifications are on for this device**. If it says the device could not be registered, try again.

Repeat on every device you want notified.

You may also be offered this once, a few seconds after you arrive: a toast
saying **Get told when someone messages you**, with **Turn on** and **No
thanks**. Dismissing it is a complete answer; the switch stays in Settings.

## Turn on notifications on an iPhone or iPad

1. In Safari, add the app to your Home Screen — the **Notifications** card shows the steps. See [First days](../get-started/first-days.md).
2. Open the app from the Home Screen icon, not from Safari.
3. Go to **Settings** → **Notifications** and press **Turn on for this device**.

## Turn off notifications for this device

1. Open **Settings** → **Notifications**.
2. Press **Turn off for this device**. A toast says **This device will not be notified**.

## Unblock notifications

If the card says **Notifications are blocked for this site**, you refused the
browser's prompt earlier. Only the browser can undo that:

1. Open your browser's site settings for this app and allow notifications.
2. Come back to **Settings** → **Notifications** and press **Turn on for this device**.

## How it works

**Per device.** Notifications are per browser, not per account, which is why
the card says "this device": a phone and a laptop each have to be asked.

**iOS.** iOS delivers web push only to an app added to the Home Screen. Not
Safari, not Chrome — the same WebKit underneath, and neither can receive them.
So on an iPhone the card checks for an installed app *before* it asks for
permission: asking somebody to allow notifications in Safari sends them to do
something that cannot work. What they get instead is the install steps.

**Permission is not the same as on.** The browser's permission is granted once,
and a page cannot take it back. Whether notifications are *on* is the app's own
record, kept per browser. Without that record, "turn off" would leave a button
that still said turn off, and the next visit would quietly register the device
again, undoing what you had just asked for.

**Signing out.** Signing out clears that record and forgets the device.
Otherwise the previous person would keep buzzing that phone until somebody else
signed in on it.

**The one-time offer.** A toast rather than a dialog: the point is that
somebody who never opens Settings still finds out notifications exist, not that
they answer before they may use the app. It is only shown where pressing it
would do something — never where the browser has already been asked, where
notifications are already on, where they were refused, or on an iPhone that has
not installed the app.

### Chat notifications

When somebody sends a message, everyone else in the room who has notifications
on gets one. It shows the room, who sent it, and a one-line preview of the
words, and tapping it opens the room. Every message in a room carries the same
tag, so one room is one line on the lock screen, however many messages arrive
while the phone is face down. A [nudge](./chat/messages.md) is a notification
with no words, carrying its own tag so it never replaces a message you have not
read yet.

### The evening reminder

Once each evening the app sends one notification, **Nothing logged today**, to
everybody whose day is still blank: no [daily log](./daily-log.md) for it
**and** no [transaction](./finance/transactions.md) dated on it. Either one is
enough to be left alone. Tapping the notification opens the daily log.

- It is scheduled for 20:00 Vietnam time and lands somewhere between 20:00 and 20:59.
- Only devices with notifications turned on in **Settings → Notifications** are reached; there is no separate switch. Turning a device off turns this off for it too.
- "Today" is each person's own, from their timezone and day rollover hour in [Settings](./settings.md). At 20:00, somebody whose day turns over at 22:00 is still on yesterday, and is asked about yesterday.
- A transaction counts by the date it is filed under, not when it was typed: last week's coffee entered tonight does not count for today.
- Every reminder carries the same tag, so a second one — a retried run, or tomorrow's — replaces the one still on the lock screen instead of stacking.
- The words follow the person's language setting.

How the reminder is scheduled and protected is in
[Scheduled jobs](../operations/scheduled-jobs.md).

## Limits

- No notifications in an iPhone or iPad browser tab; the app must be installed to the Home Screen.
- No per-room or per-kind switch: a device is either on or off.
- A refused browser permission can only be undone in the browser's settings.
- Notification previews show message words on the lock screen.

## Related

- [Chat overview](./chat/overview.md) — the messages that trigger most notifications
- [Messages](./chat/messages.md) — sending, and nudging a room
- [Daily log](./daily-log.md) — logging the day keeps the evening reminder away, and the reminder opens it
- [Transactions](./finance/transactions.md) — a transaction dated today keeps the evening reminder away too
- [Settings](./settings.md) — the Notifications card, timezone, day rollover and language
- [First days](../get-started/first-days.md) — adding the app to the Home Screen, which iOS requires
- [Sign in](../get-started/sign-in.md) — signing out forgets the device
- [Scheduled jobs](../operations/scheduled-jobs.md) — `/api/cron/reminders`
- [Configuration](../operations/configuration.md) — the push and Firebase variables
- [Push notifications (technical)](../reference/realtime/push-notifications.md) — data-only pushes, token refresh, `medaily.push.enabled`
- [Data model: core](../reference/data-model/core.md) — `push_devices`, one row per registered device
