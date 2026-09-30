# Live updates

How a message somebody else sent reaches your screen, and how "somebody is
typing" gets there without Firestore learning what anybody wrote.

Every page in this app is server-rendered per request. There is no socket and
no long-lived process to hold one — the deploy target is serverless. So
"instant" here is built out of two pieces that fail in opposite directions: a
slow timer that always works, and a doorbell that is fast and allowed to break.

---

## The two paths

| | Without the doorbell | With the doorbell |
| --- | --- | --- |
| A message appears after | 0–45 seconds | under a second |
| Anybody has to reload | no | no |
| Works signed in with the password | yes | no |
| Works with Firestore down | yes | falls back to the timer |

The 45 seconds is `FLOOR_MS` in `src/lib/hooks/use-room-live.ts`. While the tab
is visible the room asks the server anyway on that interval, and it also asks
the moment the tab becomes visible again. **That floor is what makes the
doorbell an optimisation rather than a dependency.** Without it, a sender whose
browser died between saving the message and ringing would leave everyone else
looking at a stale screen for as long as they kept it open.

---

## The doorbell

```
you send "hello"
  │
  ├─ sendMessage(...)        → the text goes to MongoDB
  │                            your own screen appends it locally, at once
  ├─ stop()                  → retract your typing claim
  └─ ringRoom(doorbellKey)   → one tiny write to Firestore: { seq: +1, at }
                                     │
                                     ▼
                        their onSnapshot fires  (~0.1–0.3s)
                                     │
                        debounce 400ms  (one ask covers a burst)
                                     │
                        catchUp() → loadNewMessages from the server
                                     │
                        "hello" appears — fetched from MongoDB, never Firestore
```

Three properties are deliberate, and each one is load-bearing.

**The signal carries nothing.** Firestore holds a counter and a time. The text
lives in MongoDB and is fetched from the server, which is the only party that
knows who may see what. A ring means "ask", never "here is what changed".

**A ring is edge-triggered.** Nothing compares `seq` against what it was.
A payload is attacker-writable, and a client that gated on a counter could be
deafened for good by one absurdly large number.

**The channel is not the room id.** `doorbellKey` is a separate uuid, rotated
by `rotateDoorbell` when somebody is removed from a room. Losing access means
losing the ability to listen, without changing anything the room is keyed by.

### Why Firestore

It is the only thing already in this stack that a browser can hold a cheap,
authenticated, persistent connection to. The alternatives were a socket server
(needs a process that outlives a request) or a paid service. The Firebase
project was already there for Google sign-in.

---

## The typing indicator

This is the one exception to "the signal carries nothing", and it is an
exception because it has to be: **there is nothing on the server to go and ask.**
Typing is not a fact worth storing — it is true for four seconds and then it is
a lie. So the claim itself travels, and the client reads it.

```
channels/{doorbellKey}/typing/{firebaseUid}  →  { at: <millis> }
```

### Why it cannot lie about who

Being signed in to this Firebase project means very little: the project's
sign-in is not gated by this app's allowlists, so it means "any Google
account". For the doorbell that is fine — the worst a stranger with a channel
key can do is ring it, and everyone wastes one fetch that returns nothing.

For a payload the UI **draws**, it is not fine. Anyone with the key could make
your screen say a name that is not typing.

The fix is in the rules rather than the code: the document is named by a
Firebase uid, and `request.auth.uid == uid` is enforced on write. A claim can
only be made in the claimant's own name. Knowing a channel key buys the ability
to say "I am typing" as yourself — which every member of the room can do
anyway — and nothing else. The reader then matches the uid against the room's
roster and draws nothing for a uid it does not recognise.

That is why `Speaker` carries `firebaseUid`, filled from
`auth_identities.provider_uid` where the provider is `google`. Anybody who
signed in with the password has none, and never appears as typing — the same
people who have no live updates at all.

### The numbers, and why each one

| Constant | Value | Why |
| --- | --- | --- |
| `TYPING_TTL_MS` | 6s | How long a claim is believed. Nothing deletes a record when a tab dies, so this is the only thing that ends one. |
| `TYPING_THROTTLE_MS` | 3s | How often a typist re-announces. Comfortably under the TTL or the indicator blinks; nowhere near per-keystroke, or a fast typist bills a hundred writes per message. |
| `SWEEP_MS` | 1s | How often the list is re-checked. A claim *expiring* is the passage of time and fires no snapshot — without the sweep the last person to stop typing types forever. |

Sending retracts the claim rather than letting it time out. The message lands
on the other screen instantly, and a name still marked as typing beside it for
the rest of the TTL reads as the app being confused. That retraction is a
delete, which is why the rules separate `delete` from `create, update`: on a
delete `request.resource` is null, and a single `write` rule inspecting the
written fields would refuse it.

### One document per person

Not one field per person on the channel document. Firestore sustains about one
write per second per document, and three people typing into one would start
dropping each other's.

---

## What Firestore ends up holding

Before the typing indicator: nothing about anybody. One document per room with
a counter and a time.

After it: **that a Firebase uid was active in a room at a time.** No word
anybody typed still reaches Firestore, and the roster, the messages and the
membership all stay in MongoDB. It is worth knowing this changed, because the
rules were previously small enough to be obviously right without it.

---

## Turning it on

Three environment variables, all needed, all read at **build** time because
`NEXT_PUBLIC_*` is baked into the bundle — adding them on the host means a
redeploy:

```
NEXT_PUBLIC_REALTIME_ENABLED=1
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
```

Then, in the Firebase console: create the Firestore database, and deploy the
rules.

```bash
pnpm firestore:rules      # or paste firestore.rules into the console
```

**Pick `asia-southeast1`** (or whichever region is nearest the people using
it). All Firestore traffic in this app is browser-to-Firestore — the server
never touches it — so latency to the user is the whole of what you feel, and a
database's location cannot be changed after it is created.

### It fails quietly, by design

The `onSnapshot` error callback in `src/lib/realtime/firestore.ts` is an empty
block. Chat must not break when Firestore is unreachable, so being refused by
rules is swallowed exactly like being offline.

The consequence: **rules that deny show up as "live updates never arrive", with
nothing in the console.** If it is not working, check that the rules deployed
before you check anything else.

The second thing to check: were you signed in with Google? `pickRealtimeSignal`
returns `NO_REALTIME` when there is no Firebase session, and the password path
has none. Testing with a password account and concluding Firestore is broken is
the easy mistake.

Third: the clock. `ring` and `announce` both write `at: Date.now()` from the
device, and the rules require it within a minute of server time. A device badly
out of sync gets its writes refused, and its messages arrive for everyone else
on the 45-second floor instead.

---

## Housekeeping

Two kinds of document accumulate, and neither can clean itself from the
browser.

**Channel documents** are orphaned when a room is deleted — `deleteRoom` only
touches MongoDB — and every time `rotateDoorbell` mints a new key. After a
rotation nobody holds the old key, and the rules require it, so no browser can
reach that document even to delete it.

**Typing claims** normally retract themselves when a message is sent or the
room is left. A tab closed mid-word gives no time for the round trip, and a
device whose clock is wrong has its writes refused, so some are left behind.

### The nightly sweep

`sweepRealtimeChannels` runs last in `/api/cron/nightly`. It lists `channels`,
and for each one:

- deletes typing claims older than **1 hour** (`TYPING_STALE_MS`)
- if the channel itself is older than **30 days** (`CHANNEL_STALE_MS`), deletes
  **every** claim under it and then the channel document

**Order matters.** Firestore does not delete a document's sub-collections with
it. Deleting the channel first would leave its claims under a document that no
longer exists — invisible in the console unless you already know to look.

Three things bound what a mistake here costs:

| Guard | Why |
| --- | --- |
| `MAX_DELETES_PER_RUN` = 500 | A blast radius, not a performance limit. A wrong threshold or a clock years ahead costs a bounded number of rows and a confusing line in the report. |
| A document with no readable `at` is **kept** | Unexplained, so reported as skipped rather than guessed at. "Delete what you do not understand" is the wrong default for a scheduled job. |
| Deletions are sorted | A run cut off by the cap takes the same first half every night and finishes, rather than an arbitrary half forever. |

Being cut off is harmless in the other direction too: a channel whose claims
went but which survived the cap is found tomorrow with nothing under it.

The decisions are in `src/lib/realtime/gc.ts`, pure and tested. The service
only carries them out.

### What it costs to have

This is the only Firebase credential in the app with real power.
`FIREBASE_SERVICE_ACCOUNT` holds the whole service-account JSON and wants
`roles/datastore.user`; its `project_id` is checked against
`NEXT_PUBLIC_FIREBASE_PROJECT_ID`, so a staging key left in a production
environment is refused rather than trusted.

Everything else here — sign-in, the doorbell, the typing indicator — runs on
public keys and security rules, with no secret to leak. That property is
genuinely weaker now, and the containment is that one small file
(`src/server/services/firestore-rest.ts`) holds the credential, speaks the REST
API rather than pulling in the Admin SDK, and is reachable only from the
nightly job.

Leave `FIREBASE_SERVICE_ACCOUNT` unset and nothing is swept, nothing
complains, and the garbage stays — a couple of numeric fields per room.

### By hand, if you prefer

```bash
npx firebase-tools firestore:delete --recursive channels
```

`--recursive` is not optional: sub-collections outlive the documents above
them. Nothing is lost either way — the next `ring` re-creates what it needs
with `setDoc(..., { merge: true })`, and the worst case is one message arriving
on the 45-second floor.

A TTL policy would be tidier but does not work as written: Firestore TTL
requires a `Timestamp` field, and `at` is a plain number the rules explicitly
require to be a number. Changing it means changing the write, the rule, and
re-thinking what stops a far-future timestamp being parked there.

---

## Where the pieces are

| File | What it holds |
| --- | --- |
| `src/lib/realtime/signal.ts` | Both contracts, and the no-op and in-memory implementations |
| `src/lib/realtime/typing.ts` | Every rule that decides whether a name appears — pure, and tested |
| `src/lib/realtime/firestore.ts` | The only file that talks to Firestore |
| `src/lib/realtime/provider.ts` | The gates: env, and a Firebase session |
| `src/lib/hooks/use-room-live.ts` | The doorbell, the 400ms debounce and the 45s floor |
| `src/lib/hooks/use-typing.ts` | Watching, sweeping, throttling, retracting |
| `src/lib/realtime/gc.ts` | What the nightly sweep may delete — pure, and tested |
| `src/server/services/firestore-rest.ts` | The only holder of a powerful Firebase credential |
| `src/server/services/realtime-gc.ts` | The sweep itself, called from `/api/cron/nightly` |
| `firestore.rules` | Deployed by hand. Read `firestore.ts` before loosening anything |
