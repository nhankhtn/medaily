---
title: Typing indicator
description: How "somebody is typing" travels through Firestore as a per-person claim that cannot be made in someone else's name, and how stale claims expire.
sidebar_position: 3
---

# Typing indicator

The typing indicator is the one exception to "the signal carries nothing", and it is an exception because it has to be: **there is nothing on the server to go and ask.** Typing is not a fact worth storing — it is true for four seconds and then it is a lie. So the claim itself travels, and the client reads it.

```text
channels/{doorbellKey}/typing/{firebaseUid}  →  { at: <millis> }
```

`doorbellKey` is the room's channel key from [The doorbell](./doorbell.md).

## Why it cannot lie about who

Being signed in to this Firebase project means very little: the project's sign-in is not gated by this app's allowlists, so it means "any Google account". For the doorbell that is fine — the worst a stranger with a channel key can do is ring it, and everyone wastes one fetch that returns nothing.

For a payload the UI **draws**, it is not fine. Anyone with the key could make your screen say a name that is not typing.

The fix is in the rules rather than the code: the document is named by a Firebase uid, and `request.auth.uid == uid` is enforced on write. A claim can only be made in the claimant's own name. Knowing a channel key buys the ability to say "I am typing" as yourself — which every member of the room can do anyway — and nothing else.

The reader then matches uids against the room's roster. That is why `Speaker` carries `firebaseUid`: `speakersOf` fills it from `auth_identities.provider_uid` where the provider is `google`, and otherwise with the person's own id — the same uid the server mints a custom token under (see [Who Firestore thinks you are](./setup.md#who-firestore-thinks-you-are)). It is null only for somebody who erased their account. The room uses it twice:

- **Its own uid** comes from the roster too — `speakers[me]?.firebaseUid` — rather than from Firebase directly. The roster is what the names are drawn from, so if the two ever disagree the indicator should follow the one the UI uses.
- **Names** are resolved by looking each typing uid up by `firebaseUid`. A uid with no member behind it is dropped, not shown as "former member": the doorbell key is all it takes to make a claim, and an unrecognised claimant is exactly the case not worth drawing.

## The numbers, and why each one

| Constant | Value | Why |
| --- | --- | --- |
| `TYPING_TTL_MS` | 6s | How long a claim is believed. Nothing deletes a record when a tab dies, so this is the only thing that ends one. |
| `TYPING_THROTTLE_MS` | 3s | How often a typist re-announces. Comfortably under the TTL or the indicator blinks; nowhere near per-keystroke, or a fast typist bills a hundred writes per message. |
| `SWEEP_MS` | 1s | How often the list is re-checked. A claim *expiring* is the passage of time and fires no snapshot — without the sweep the last person to stop typing types forever. |

Typists are listed sorted by uid, not by time. They are drawn as names, and names that reorder themselves while two people type read as flicker.

## Clocks that are wrong

Every `at` is written by the claimant's device, so two of the rules in `src/lib/realtime/typing.ts` assume the clock can be off:

- `shouldAnnounce` treats a last announcement **in the future** as due. A clock that jumps backwards — a phone correcting itself, a laptop waking — would otherwise silence the typist until real time caught up. It costs one extra write.
- `activeTypists` believes a claim while `Math.abs(now - at)` is under the TTL. The window is symmetric: a claim from the future is a clock askew, not a claim about later, and without the `abs` it would outlive an honest one by however far ahead the clock was.

The nightly sweep's `isStale` uses the same symmetric test, for the same reason — see [Housekeeping](./housekeeping.md).

## Taking the claim back

Sending retracts the claim rather than letting it time out. The message lands on the other screen instantly, and a name still marked as typing beside it for the rest of the TTL reads as the app being confused. That retraction is a delete, which is why the rules separate `delete` from `create, update`: on a delete `request.resource` is null, and a single `write` rule inspecting the written fields would refuse it.

Leaving the room — unmounting, or switching to another channel — also retracts, but **only if this tab announced** since it last sent. A tab that merely watched has nothing to take back, and a delete it is not owed would be a wasted write per room visit. Closing the tab gives no time for the round trip at all, which is what the TTL is ultimately for.

## One document per person

Not one field per person on the channel document. Firestore sustains about one write per second per document, and three people typing into one would start dropping each other's.

## Related

- [The doorbell](./doorbell.md) — the channel key claims are stored under, and the order of retract, send and ring
- [Live updates](./overview.md) — what Firestore ends up holding because of this
- [Setup](./setup.md) — the console lines when a typing watch, announce or retract is refused, and the custom-token uid
- [Housekeeping](./housekeeping.md) — sweeping claims left behind by closed tabs and wrong clocks
- [Messages](../../features/chat/messages.md) — where the indicator is shown
- [Privacy](../../features/chat/privacy.md) — what reaches Firestore and what does not
- [Core data model](../data-model/core.md) — `auth_identities.provider_uid`, the Google uid
- [Chat data model](../data-model/chat.md) — the roster the uids are matched against
