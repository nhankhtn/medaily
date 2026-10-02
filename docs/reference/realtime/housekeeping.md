---
title: Housekeeping
description: The nightly sweep of orphaned Firestore channels and stale typing claims, what the service account it needs can do, and cleaning up by hand.
sidebar_position: 5
---

# Housekeeping

Two kinds of Firestore document accumulate, and neither can clean itself from the browser. A nightly sweep removes them using the app's one powerful Firebase credential; this page covers what it deletes, the guards on it, what that credential costs to hold, and how to do the same by hand.

## What accumulates

**Channel documents** are orphaned when a room is deleted — `deleteRoom` only touches MongoDB — and every time `rotateDoorbell` mints a new key. After a rotation nobody still in the room holds the old key, and the rules require it, so no browser of theirs can reach that document even to delete it. See [The doorbell](./doorbell.md).

**Typing claims** normally retract themselves when a message is sent or the room is left. A tab closed mid-word gives no time for the round trip, and a device whose clock is wrong has its writes refused, so some are left behind. See [Typing indicator](./typing-indicator.md).

## The nightly sweep

`sweepRealtimeChannels` runs last in `/api/cron/nightly`. It lists `channels`, and for each one:

- deletes typing claims older than **1 hour** (`TYPING_STALE_MS`)
- if the channel itself is older than **30 days** (`CHANNEL_STALE_MS`), deletes **every** claim under it and then the channel document

**Order matters.** Firestore does not delete a document's sub-collections with it. Deleting the channel first would leave its claims under a document that no longer exists — invisible in the console unless you already know to look.

Age is judged by `isStale`, which uses the same symmetric `Math.abs(now - at)` test as the typing indicator, so a timestamp from a clock running ahead is not treated as fresh forever.

Three things bound what a mistake here costs:

| Guard | Why |
| --- | --- |
| `MAX_DELETES_PER_RUN` = 500 | A blast radius, not a performance limit. A wrong threshold or a clock years ahead costs a bounded number of rows and a confusing line in the report. |
| A document with no readable `at` is **kept** | Unexplained, so reported as skipped rather than guessed at. "Delete what you do not understand" is the wrong default for a scheduled job. |
| Claims are deleted in sorted order | Within a channel, a run cut off by the cap takes the same claims first every night rather than an arbitrary set. Channels themselves are visited in the order Firestore lists them. |

Being cut off is harmless in the other direction too: a channel whose claims went but which survived the cap is found tomorrow with nothing under it.

The run reports what it did as `{ channels, typing, skipped, capped }`, and the nightly route adds `failed` when the sweep threw. The job report on the phone is sent only on a night that deleted something or went wrong, and it carries the channels and claims removed, whether the cap was hit or the sweep failed, and — when there are any — how many documents were skipped for having no readable time.

The decisions are in `src/lib/realtime/gc.ts`, pure and tested. The service (`src/server/services/realtime-gc.ts`) only carries them out.

## What it costs to have

This is the only Firebase credential in the app with real power. `FIREBASE_SERVICE_ACCOUNT` holds the whole service-account JSON and wants `roles/datastore.user` (push widens it — see [Push notifications](./push-notifications.md)); its `project_id` is checked against `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, so a staging key left in a production environment is refused rather than trusted.

Sign-in and the doorbell still run on public keys and security rules, with no secret to leak. Two things use this one, and both go through `readFirestoreAdminConfig` in `src/server/services/firestore-rest.ts`: the sweep, and the custom token in `src/server/services/firebase-custom-token.ts`. The containment is that both speak a narrow protocol rather than pulling in the Admin SDK, and that nothing else in the tree reads the key.

Leave `FIREBASE_SERVICE_ACCOUNT` unset and nothing is swept, nothing complains, and the garbage stays — a couple of numeric fields per room. The typing indicator and the doorbell are the parts that then stop working for password sign-ins: see [Who Firestore thinks you are](./setup.md#who-firestore-thinks-you-are). Set it but malformed, or for the wrong project, and the token path logs `FIREBASE_SERVICE_ACCOUNT is set but unusable` server side and returns nothing, while the sweep fails and says so in the nightly report.

## By hand, if you prefer

```bash
npx firebase-tools firestore:delete --recursive channels
```

`--recursive` is not optional: sub-collections outlive the documents above them. Nothing is lost either way — the next `ring` re-creates what it needs with `setDoc(..., { merge: true })`, and the worst case is one message arriving on the 45-second floor.

A TTL policy would be tidier but does not work as written: Firestore TTL requires a `Timestamp` field, and `at` is a plain number the rules explicitly require to be a number. Changing it means changing the write, the rule, and re-thinking what stops a far-future timestamp being parked there.

## Related

- [Scheduled jobs](../../operations/scheduled-jobs.md) — `/api/cron/nightly`, which runs the sweep last, and its job report
- [Configuration](../../operations/configuration.md) — `FIREBASE_SERVICE_ACCOUNT` and the other Firebase variables
- [The doorbell](./doorbell.md) — why rotation and room deletion orphan channels
- [Typing indicator](./typing-indicator.md) — the claims swept, and the symmetric staleness test
- [Setup](./setup.md) — the custom token, the other user of the service account
- [Push notifications](./push-notifications.md) — the extra role push adds to the same service account
- [Rooms and invites](../../features/chat/rooms-and-invites.md) — deleting a room and removing a member, which leave channels behind
