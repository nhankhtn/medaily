---
title: Setup and troubleshooting
description: The environment variables and Firestore rules live updates need, what the console says when they are off, and how password sign-ins get a Firebase session.
sidebar_position: 4
---

# Setup and troubleshooting

Live updates need three build-time variables, a Firestore database and its rules; password sign-ins also need a server-side service account. When something is missing, chat keeps working on the slow floor and the browser console says why. This page covers turning it on, reading those console lines, and how the server vouches for a password sign-in with a custom token.

## Turning it on

Three environment variables, all needed, all read at **build** time because `NEXT_PUBLIC_*` is baked into the bundle — adding them on the host means a redeploy:

```text
NEXT_PUBLIC_REALTIME_ENABLED=1
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
```

A fourth is optional and server-side, read at run time: `FIREBASE_SERVICE_ACCOUNT`. Without it Google sign-ins get live updates and password sign-ins do not, and nothing is swept. See [What it costs to have](./housekeeping.md#what-it-costs-to-have).

Then, in the Firebase console: create the Firestore database, and deploy the rules.

```bash
pnpm firestore:rules      # or paste firestore.rules into the console
```

The script is `npx -y firebase-tools deploy --only firestore:rules`, so `bun run firestore:rules` does the same thing; the first run asks you to `npx firebase-tools login`.

**Pick `asia-southeast1`** (or whichever region is nearest the people using it). All Firestore traffic in this app is browser-to-Firestore — the server never touches it — so latency to the user is the whole of what you feel, and a database's location cannot be changed after it is created.

To check what a deploy was built with, `/api/health` reports `realtimeConfigured`. It is `realtimeEnabled()` evaluated against the baked-in `NEXT_PUBLIC_*` values, so it answers what the browser was handed, not what the process can see now. It does not say the rules are deployed.

## It fails quietly, but not silently

Chat must not break when Firestore is unreachable, so nothing here throws at the person using it. But "quiet" used to mean "nothing in the console", and that made a missing rule indistinguishable from a missing flag. Today:

| What closed | What the console says |
| --- | --- |
| A gate in `provider.ts` — no Firebase config, the flag not `"1"`, or no session that could be opened | `[realtime] live updates are off: <reason>`, once per reason per page |
| Opening a session with a custom token threw | `[realtime] could not open a Firebase session`, with the error |
| A typing watch, announce or retract was refused | `[realtime] typing <where> was refused: <code>`, once per `where` and code; on `permission-denied` it adds a hint to run `pnpm firestore:rules` |
| The doorbell listener was refused | **nothing** — its `onSnapshot` error callback is still an empty block |
| A ring was refused | nothing — `ringRoom` swallows it, and the floor covers it |

So if live updates never arrive, look in the console first. If it says nothing and typing names do appear, the doorbell's rules are the suspect: that one listener is the only part still silent. Over WebChannel a refused write still answers 200, so the network tab will not tell you either.

The second thing to check is the session. `pickRealtimeSignal` returns `NO_REALTIME` only when there is no Firebase session **and** none could be opened. A password sign-in on a deploy without `FIREBASE_SERVICE_ACCOUNT` is the usual cause, and the console line names it. Testing with a password account on such a deploy and concluding Firestore is broken is the easy mistake.

Third: the clock. `ring` and `announce` both write `at: Date.now()` from the device, and the rules require it within a minute of server time. A device badly out of sync gets its writes refused, and its messages arrive for everyone else on the 45-second floor instead.

## Who Firestore thinks you are

Firestore rules tie a typing claim to `request.auth.uid`, and every rule needs `request.auth != null`, so both the doorbell and typing need a Firebase session. Signing in with Google leaves one behind; signing in with the password never did, and that path exists precisely as the way back in when Firebase is unreachable. Live updates therefore belonged to whoever had arrived through Google — and on an iPhone, where One Tap never draws (`oneTapAvailable` returns `!isIos()`), the password form is the path of least resistance. The same person could see somebody typing on a laptop and not on their phone, with nothing on screen to say why. Even a Google session does not last: Safari clears site data after a week idle, and a home-screen app keeps its own, while this app's cookie outlives both.

So the server vouches instead. In the browser, `provider.ts` does this:

```text
realtimeOff()
  │
  ├─ await auth.authStateReady()   → wait for Firebase to restore from storage
  ├─ currentUser?  ───────────────→ yes: on
  └─ adopt(auth)                   → at most once per page
       ├─ realtimeToken()          → server action; the cookie is the credential
       │    null  ────────────────→ off, and the console says why, once
       └─ signInWithCustomToken    → on
```

The wait matters. Firebase restores a session asynchronously, so for the first few hundred milliseconds of a page `currentUser` is null even for somebody who is signed in. Deciding then would conclude "no session" on a fresh load, and nothing asks again — the room would sit on the slow floor for as long as it stayed open.

`realtimeToken` (`src/server/actions/realtime.ts`) mints a Firebase custom token for the session it has already authenticated by cookie. The uid is chosen server side, so a browser cannot ask to be somebody else — the Firebase uid Google sign-in already minted when there is one, so the two paths land on the same Firebase user, and otherwise the app's own id, which is a uuid and cannot collide with a Firebase uid. `speakersOf` picks the same uid by the same rule; if those two ever disagree, a typing document lands under a name no reader recognises and the indicator simply never draws (see [Typing indicator](./typing-indicator.md)).

The token lives **55 minutes** — Firebase refuses anything over an hour, and the gap leaves room for clock skew. It only has to survive the exchange: once traded, the session is Firebase's own and refreshes itself. The browser asks for one **at most once per page load**; a second attempt would fail for the same reason as the first.

This hands out no authority the project had not already given away: the rules read `request.auth != null`, and the project's sign-in is not gated by the app's allowlists, so that already meant any Google account on the internet. What keeps a room private is the 122-bit channel key.

Without the service account nothing breaks — the token comes back null, the console says so once, and the room falls back to asking on the slow floor, the same as before. Set but malformed, or for the wrong project, the token path logs `FIREBASE_SERVICE_ACCOUNT is set but unusable` server side and returns nothing — see [What it costs to have](./housekeeping.md#what-it-costs-to-have).

## Related

- [Live updates](./overview.md) — the two paths, and what Firebase Authentication ends up holding
- [The doorbell](./doorbell.md) — the listener whose refusal is still silent
- [Typing indicator](./typing-indicator.md) — why the uid chosen here must match `speakersOf`
- [Housekeeping](./housekeeping.md) — the other use of `FIREBASE_SERVICE_ACCOUNT`, and its permissions
- [Push notifications](./push-notifications.md) — the extra variable and role push needs
- [Sign in](../../get-started/sign-in.md) — Google, password and One Tap
- [Chat overview](../../features/chat/overview.md) — what the person sees when live updates are off
- [Configuration](../../operations/configuration.md) — every environment variable
- [Core data model](../data-model/core.md) — `auth_identities`, where the Google uid comes from
