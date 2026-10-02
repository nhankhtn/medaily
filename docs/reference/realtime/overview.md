---
title: Live updates
description: How chat messages and typing reach other screens on a serverless deploy — a slow polling floor plus a Firestore doorbell that carries no content.
sidebar_position: 1
---

# Live updates

This section explains how a message somebody else sent reaches your screen, and how "somebody is typing" gets there without Firestore learning what anybody wrote.

Every page in this app is server-rendered per request. There is no socket and no long-lived process to hold one — the deploy target is serverless. So "instant" here is built out of two pieces that fail in opposite directions: a slow timer that always works, and a doorbell that is fast and allowed to break.

## The two paths

| | Without the doorbell | With the doorbell |
| --- | --- | --- |
| A message appears after | 0–45 seconds | under a second |
| Anybody has to reload | no | no |
| Works signed in with the password | yes | yes, when the server holds `FIREBASE_SERVICE_ACCOUNT` — otherwise falls back to the timer |
| Works with Firestore down | yes | falls back to the timer |

The password row depends on the deploy, not on the person. A Google sign-in leaves a Firebase session in the browser; a password sign-in does not, and the server has to vouch for it with a custom token — which it can only mint with the service account. See [Who Firestore thinks you are](./setup.md#who-firestore-thinks-you-are).

The 45 seconds is `FLOOR_MS` in `src/lib/hooks/use-room-live.ts`. While the tab is visible the room asks the server anyway on that interval, and it also asks the moment the tab becomes visible again. **That floor is what makes the doorbell an optimisation rather than a dependency.** Without it, a sender whose browser died between saving the message and ringing would leave everyone else looking at a stale screen for as long as they kept it open.

How the fast path works is on [The doorbell](./doorbell.md); the one signal that does carry a payload is the [typing indicator](./typing-indicator.md).

## Why Firestore

It is the only thing already in this stack that a browser can hold a cheap, authenticated, persistent connection to. The alternatives were a socket server (needs a process that outlives a request) or a paid service. The Firebase project was already there for Google sign-in.

## What Firestore ends up holding

Before the typing indicator: nothing about anybody. One document per room with a counter and a time.

After it: **that a Firebase uid was active in a room at a time.** No word anybody typed still reaches Firestore, and the roster, the messages and the membership all stay in MongoDB. It is worth knowing this changed, because the rules were previously small enough to be obviously right without it.

Firebase Authentication holds a little more than it used to, as well. A password sign-in that trades a custom token for a session, by somebody who has never signed in with Google, creates a Firebase user under the app's own user id — a uuid, and nothing else about the person. See [Who Firestore thinks you are](./setup.md#who-firestore-thinks-you-are).

## Where the pieces are

| File | What it holds |
| --- | --- |
| `src/lib/realtime/signal.ts` | Both contracts, and the no-op and in-memory implementations |
| `src/lib/realtime/typing.ts` | Every rule that decides whether a name appears — pure, and tested |
| `src/lib/realtime/firestore.ts` | The only browser file that talks to Firestore, and the once-per-code typing complaints |
| `src/lib/realtime/provider.ts` | The gates: env, and a Firebase session — restored, or adopted from a custom token |
| `src/lib/hooks/use-room-live.ts` | The doorbell, the 400ms debounce and the 45s floor |
| `src/lib/hooks/use-typing.ts` | Watching, sweeping, throttling, retracting |
| `src/features/chat/room-view.tsx` | What rings and when, `catchUp`, and turning typing uids into names |
| `src/features/chat/unread-watch.tsx` | The badge's listener on every room, the 800ms settle and the 60s floor |
| `src/lib/realtime/gc.ts` | What the nightly sweep may delete — pure, and tested |
| `src/server/actions/realtime.ts` | `realtimeToken`, the server action the browser trades for a Firebase session |
| `src/server/services/firebase-custom-token.ts` | Choosing the uid and signing the custom token |
| `src/server/services/firestore-rest.ts` | Reading and checking the service account, and the REST client the sweep uses |
| `src/server/services/realtime-gc.ts` | The sweep itself, called from `/api/cron/nightly` |
| `src/lib/push/client.ts` | Permission, availability, and this app's own record |
| `src/server/services/google-auth.ts` | The one service account, and a token per scope |
| `src/server/services/push.ts` | Sending, and dropping a token FCM refuses |
| `src/server/services/chat-notify.ts` | What a room's notification says — the wording is tested |
| `firestore.rules` | Deployed by hand. Read `firestore.ts` before loosening anything |

## Pages in this section

| Page | Covers |
| --- | --- |
| [The doorbell](./doorbell.md) | The ring, `catchUp`, what rings, leaving vs removal, the unread badge |
| [Typing indicator](./typing-indicator.md) | The one signal that carries a claim, and why it cannot lie about who |
| [Setup](./setup.md) | Turning it on, troubleshooting, and the custom token for password sign-ins |
| [Housekeeping](./housekeeping.md) | The nightly sweep, what the service account costs, cleaning up by hand |
| [Push notifications](./push-notifications.md) | Reaching a phone that is face down |

## Related

- [Chat overview](../../features/chat/overview.md) — the feature these mechanisms serve
- [Messages](../../features/chat/messages.md) — sending, reactions and recalls, all of which ring the doorbell
- [Notifications](../../features/notifications.md) — the user-facing side of push
- [Sign in](../../get-started/sign-in.md) — Google vs password sign-in, which decides whether a Firebase session exists
- [Configuration](../../operations/configuration.md) — the Firebase environment variables
- [Chat data model](../data-model/chat.md) — where messages, rooms and `doorbellKey` actually live
- [Data model](../data-model/overview.md) — the Postgres, MongoDB and Firestore split
