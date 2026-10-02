---
title: Push notifications
description: How web push reaches a phone through FCM — data-only messages drawn by sw.js, the iOS Home Screen rule, token refresh, and what "on" means.
sidebar_position: 6
---

# Push notifications

A doorbell reaches a tab that is open. A notification reaches a phone that is face down, which is the other half of the same problem. This page is the technical side: how messages are sent, what the service worker must do, why iOS is special, and how a device's registration is kept honest. What you see and turn on is on [Notifications](../../features/notifications.md).

FCM itself is free on the Spark plan — unlimited messages, no overage. What it costs is in two other places: the data-only rule below, and a wider role on the service account (see [What it needs](#what-it-needs)).

## Data-only, and why

Every message is sent **without** a `notification` block. One carrying it is drawn by the browser, so the words are fixed at send time and cannot be shortened, replaced or collapsed on the device. Data-only hands the payload to the service worker and `sw.js` draws it — which is also what keeps the Firebase SDK out of that file. It is plain JS with no build step on purpose, and `importScripts` of a compat bundle would end that.

> **Important:** The price is a rule that must not be broken: **a push event has to end in a visible notification.** A browser receiving pushes that show nothing revokes the permission, so every path in the `push` handler calls `showNotification`, including the one for a payload it cannot parse.

What a chat room's notification says is decided in `src/server/services/chat-notify.ts`, and the wording is tested.

## iOS, again

**iOS delivers web push only to an app added to the Home Screen.** Not Safari, not Chrome — the same WebKit underneath, and neither issues a token. So the settings card checks for an installed app *before* it checks the permission: an iPhone in Safari reports `default` and then delivers nothing, and asking somebody to allow notifications there sends them to do something that cannot work. What they get instead is the install steps.

FCM also rotates tokens on its own, with reports of it doing so on iOS after a handful of notifications. `PushRefresh` re-registers on every load of the shell for that reason — a token stored once, at the moment somebody pressed the button, is a device that quietly stops being reachable with nothing to see. Each confirmation moves `push_devices.last_seen_at` forward.

## Permission is not the same as on

Two facts, and conflating them breaks both directions. The browser permission is granted once and a page cannot take it back. This app's own record — `medaily.push.enabled`, per browser — is what "on" means here.

Without the second, "turn off" would leave a button that still said turn off, and the silent refresh on the next load would register the device again, undoing what somebody had just asked for.

Signing out clears the record and deletes the row. Otherwise the previous person keeps buzzing that phone until somebody signs in and the token changes owner — and a token moving owner is exactly what `push_devices_token_uniq` exists for (see [`push_devices`](../data-model/core.md)).

## What it needs

`NEXT_PUBLIC_FIREBASE_VAPID_KEY` (Firebase Console → Project settings → Cloud Messaging → Web configuration), and `FIREBASE_SERVICE_ACCOUNT` widened to `roles/firebasemessaging.admin` on top of `roles/datastore.user`. Unset, the card never appears and chat works exactly as before.

A token FCM refuses with 404 or 403 is deleted on the spot rather than retried nightly: it is dead for everyone, not just for this send.

## Where the pieces are

| File | What it holds |
| --- | --- |
| `src/lib/push/client.ts` | Permission, availability, and this app's own record |
| `src/server/services/google-auth.ts` | The one service account, and a token per scope |
| `src/server/services/push.ts` | Sending, and dropping a token FCM refuses |
| `src/server/services/chat-notify.ts` | What a room's notification says — the wording is tested |

The full list for live updates is on [Live updates](./overview.md).

## Related

- [Notifications](../../features/notifications.md) — turning notifications on per device, the iOS install requirement, chat notifications and the evening reminder
- [Core data model](../data-model/core.md) — `push_devices`, keyed by token
- [Live updates](./overview.md) — the doorbell for open tabs, the other half of the problem
- [Housekeeping](./housekeeping.md) — the same service account, and its `roles/datastore.user` role
- [Setup](./setup.md) — the other Firebase variables
- [Messages](../../features/chat/messages.md) — what triggers a chat notification
- [First days](../../get-started/first-days.md) — adding the app to the home screen
- [Scheduled jobs](../../operations/scheduled-jobs.md) — `/api/cron/reminders`, the evening reminder sent as push
- [Configuration](../../operations/configuration.md) — `NEXT_PUBLIC_FIREBASE_VAPID_KEY` and `FIREBASE_SERVICE_ACCOUNT`
