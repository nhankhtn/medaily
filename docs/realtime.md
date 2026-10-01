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
| Works signed in with the password | yes | yes, when the server holds `FIREBASE_SERVICE_ACCOUNT` — otherwise falls back to the timer |
| Works with Firestore down | yes | falls back to the timer |

The password row depends on the deploy, not on the person. A Google sign-in
leaves a Firebase session in the browser; a password sign-in does not, and the
server has to vouch for it with a custom token — which it can only mint with
the service account. See [Who Firestore thinks you are](#who-firestore-thinks-you-are).

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
  ├─ the row appears on your screen at once, under a client id
  ├─ stop()                  → retract your typing claim (before the request)
  ├─ sendMessage(...)        → the text goes to MongoDB; the stored row
  │                            replaces the placeholder
  └─ ringRoom(doorbellKey)   → only after it is saved: one tiny write to
                               Firestore: { seq: +1, at }
                                     │
                                     ▼
                        their onSnapshot fires  (~0.1–0.3s)
                                     │
                        debounce 400ms  (one ask covers a burst)
                                     │
                        catchUp():
                          loadNewMessages, page after page while `more`
                          then loadRecentMessages, to refresh rows already shown
                                     │
                        "hello" appears — fetched from MongoDB, never Firestore
```

The order is deliberate at both ends. The claim is retracted **before** the
request, because the name should go the moment the words do, not a round trip
later. The ring goes **after** the save, so nobody is sent looking for a
message that is not there yet.

`catchUp` keeps paging while the server says there is more: stopping at the
first page would move the cursor past messages that were never shown, leaving
a hole nothing goes back for. Paging forward only brings rows that did not
exist before, so it then reloads the most recent page and swaps in any row
that changed — otherwise a recall or a reaction on a message already on screen
would never reach anyone else.

That is also why sending is not the only thing that rings. **Toggling a
reaction and recalling a message ring the doorbell too** — `toggleReaction`
returns the room's `doorbellKey` for it, and a recall rings the key the room
was opened with. Without the ring, a recalled message would stay readable on
other screens until the floor came round.

Three properties are deliberate, and each one is load-bearing.

**The signal carries nothing.** Firestore holds a counter and a time. The text
lives in MongoDB and is fetched from the server, which is the only party that
knows who may see what. A ring means "ask", never "here is what changed".

**A ring is edge-triggered.** Nothing compares `seq` against what it was.
A payload is attacker-writable, and a client that gated on a counter could be
deafened for good by one absurdly large number. The one snapshot that is
ignored is a local echo — `metadata.hasPendingWrites` — which is this tab's
own ring before the server has seen it, not news from anyone else.

**The channel is not the room id.** `doorbellKey` is a separate uuid, rotated
by `rotateDoorbell` when somebody is removed from a room. Losing access means
losing the ability to listen, without changing anything the room is keyed by.

### Leaving is not removal

Only `removeMember` rotates the key. **`leaveRoom` does not**, and neither does
erasing an account. Somebody who leaves a room on their own keeps a working
copy of its key: they can no longer read a message — that is the server's
call, and it says no — but they can still hear the doorbell ring, which tells
them when the room is busy, and still list its typing claims, which tells them
which Firebase uids are active in it. This is a known gap, not a decision.

### The unread badge listens too

The room is not the only listener. `UnreadWatch`
(`src/features/chat/unread-watch.tsx`) is mounted once in
`src/app/(app)/layout.tsx` and listens to the doorbell of **every** room the
person is in — the keys come from `unreadForShell`, out of the same read of the
room list that produces the badge count.

| | The room | The badge |
| --- | --- | --- |
| Listens to | one room's key | every room's key |
| On a ring | `catchUp()` | `router.refresh()` |
| Settles for | 400ms (`DEBOUNCE_MS`) | 800ms (`SETTLE_MS`) — several rooms can ring at once |
| Floor | 45s (`FLOOR_MS`) | 60s (its own `FLOOR_MS`) |
| On the tab becoming visible | asks | refreshes |

Why every room's key rather than one channel per person: somebody would have
to ring a per-person channel, and the only client that knows a message was
sent is the sender's — which would then need everybody else's key. A key other
people hold is not a key. Listening to the rooms costs no extra writes, because
these are the channels the rooms already ring. Counting stays the server's
job; a ring only asks the layout to render again.

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
anyway — and nothing else.

The reader then matches uids against the room's roster. That is why `Speaker`
carries `firebaseUid`: `speakersOf` fills it from `auth_identities.provider_uid`
where the provider is `google`, and otherwise with the person's own id — the
same uid the server mints a custom token under. It is null only for somebody
who erased their account. The room uses it twice:

- **Its own uid** comes from the roster too — `speakers[me]?.firebaseUid` —
  rather than from Firebase directly. The roster is what the names are drawn
  from, so if the two ever disagree the indicator should follow the one the UI
  uses.
- **Names** are resolved by looking each typing uid up by `firebaseUid`. A uid
  with no member behind it is dropped, not shown as "former member": the
  doorbell key is all it takes to make a claim, and an unrecognised claimant is
  exactly the case not worth drawing.

### The numbers, and why each one

| Constant | Value | Why |
| --- | --- | --- |
| `TYPING_TTL_MS` | 6s | How long a claim is believed. Nothing deletes a record when a tab dies, so this is the only thing that ends one. |
| `TYPING_THROTTLE_MS` | 3s | How often a typist re-announces. Comfortably under the TTL or the indicator blinks; nowhere near per-keystroke, or a fast typist bills a hundred writes per message. |
| `SWEEP_MS` | 1s | How often the list is re-checked. A claim *expiring* is the passage of time and fires no snapshot — without the sweep the last person to stop typing types forever. |

Typists are listed sorted by uid, not by time. They are drawn as names, and
names that reorder themselves while two people type read as flicker.

### Clocks that are wrong

Every `at` is written by the claimant's device, so two of the rules in
`src/lib/realtime/typing.ts` assume the clock can be off:

- `shouldAnnounce` treats a last announcement **in the future** as due. A clock
  that jumps backwards — a phone correcting itself, a laptop waking — would
  otherwise silence the typist until real time caught up. It costs one extra
  write.
- `activeTypists` believes a claim while `Math.abs(now - at)` is under the TTL.
  The window is symmetric: a claim from the future is a clock askew, not a
  claim about later, and without the `abs` it would outlive an honest one by
  however far ahead the clock was.

The nightly sweep's `isStale` uses the same symmetric test, for the same
reason.

### Taking the claim back

Sending retracts the claim rather than letting it time out. The message lands
on the other screen instantly, and a name still marked as typing beside it for
the rest of the TTL reads as the app being confused. That retraction is a
delete, which is why the rules separate `delete` from `create, update`: on a
delete `request.resource` is null, and a single `write` rule inspecting the
written fields would refuse it.

Leaving the room — unmounting, or switching to another channel — also
retracts, but **only if this tab announced** since it last sent. A tab that
merely watched has nothing to take back, and a delete it is not owed would be a
wasted write per room visit. Closing the tab gives no time for the round trip
at all, which is what the TTL is ultimately for.

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

Firebase Authentication holds a little more than it used to, as well. A
password sign-in that trades a custom token for a session, by somebody who has
never signed in with Google, creates a Firebase user under the app's own user
id — a uuid, and nothing else about the person.

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

A fourth is optional and server-side, read at run time:
`FIREBASE_SERVICE_ACCOUNT`. Without it Google sign-ins get live updates and
password sign-ins do not, and nothing is swept. See
[What it costs to have](#what-it-costs-to-have).

Then, in the Firebase console: create the Firestore database, and deploy the
rules.

```bash
pnpm firestore:rules      # or paste firestore.rules into the console
```

The script is `npx -y firebase-tools deploy --only firestore:rules`, so
`bun run firestore:rules` does the same thing; the first run asks you to
`npx firebase-tools login`.

**Pick `asia-southeast1`** (or whichever region is nearest the people using
it). All Firestore traffic in this app is browser-to-Firestore — the server
never touches it — so latency to the user is the whole of what you feel, and a
database's location cannot be changed after it is created.

To check what a deploy was built with, `/api/health` reports
`realtimeConfigured`. It is `realtimeEnabled()` evaluated against the baked-in
`NEXT_PUBLIC_*` values, so it answers what the browser was handed, not what the
process can see now. It does not say the rules are deployed.

### It fails quietly, but not silently

Chat must not break when Firestore is unreachable, so nothing here throws at
the person using it. But "quiet" used to mean "nothing in the console", and
that made a missing rule indistinguishable from a missing flag. Today:

| What closed | What the console says |
| --- | --- |
| A gate in `provider.ts` — no Firebase config, the flag not `"1"`, or no session that could be opened | `[realtime] live updates are off: <reason>`, once per reason per page |
| Opening a session with a custom token threw | `[realtime] could not open a Firebase session`, with the error |
| A typing watch, announce or retract was refused | `[realtime] typing <where> was refused: <code>`, once per `where` and code; on `permission-denied` it adds a hint to run `pnpm firestore:rules` |
| The doorbell listener was refused | **nothing** — its `onSnapshot` error callback is still an empty block |
| A ring was refused | nothing — `ringRoom` swallows it, and the floor covers it |

So if live updates never arrive, look in the console first. If it says nothing
and typing names do appear, the doorbell's rules are the suspect: that one
listener is the only part still silent. Over WebChannel a refused write still
answers 200, so the network tab will not tell you either.

The second thing to check is the session. `pickRealtimeSignal` returns
`NO_REALTIME` only when there is no Firebase session **and** none could be
opened. A password sign-in on a deploy without `FIREBASE_SERVICE_ACCOUNT` is
the usual cause, and the console line names it. Testing with a password
account on such a deploy and concluding Firestore is broken is the easy
mistake.

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
rotation nobody still in the room holds the old key, and the rules require it,
so no browser of theirs can reach that document even to delete it.

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
| Claims are deleted in sorted order | Within a channel, a run cut off by the cap takes the same claims first every night rather than an arbitrary set. Channels themselves are visited in the order Firestore lists them. |

Being cut off is harmless in the other direction too: a channel whose claims
went but which survived the cap is found tomorrow with nothing under it.

The run reports what it did as `{ channels, typing, skipped, capped }`, and the
nightly route adds `failed` when the sweep threw. The job report on the phone
is sent only on a night that deleted something or went wrong, and it carries
the channels and claims removed, whether the cap was hit or the sweep failed,
and — when there are any — how many documents were skipped for having no
readable time.

The decisions are in `src/lib/realtime/gc.ts`, pure and tested. The service
only carries them out.

### What it costs to have

This is the only Firebase credential in the app with real power.
`FIREBASE_SERVICE_ACCOUNT` holds the whole service-account JSON and wants
`roles/datastore.user`; its `project_id` is checked against
`NEXT_PUBLIC_FIREBASE_PROJECT_ID`, so a staging key left in a production
environment is refused rather than trusted.

Sign-in and the doorbell still run on public keys and security rules, with no
secret to leak. Two things use this one, and both go through
`readFirestoreAdminConfig` in `src/server/services/firestore-rest.ts`: the
sweep, and the custom token in `src/server/services/firebase-custom-token.ts`.
The containment is that both speak a narrow protocol rather than pulling in
the Admin SDK, and that nothing else in the tree reads the key.

Leave `FIREBASE_SERVICE_ACCOUNT` unset and nothing is swept, nothing
complains, and the garbage stays — a couple of numeric fields per room. The
typing indicator and the doorbell are the parts that then stop working for
password sign-ins: see below. Set it but malformed, or for the wrong project,
and the token path logs `FIREBASE_SERVICE_ACCOUNT is set but unusable` server
side and returns nothing, while the sweep fails and says so in the nightly
report.

### Who Firestore thinks you are

Firestore rules tie a typing claim to `request.auth.uid`, and every rule needs
`request.auth != null`, so both the doorbell and typing need a Firebase
session. Signing in with Google leaves one behind; signing in with the
password never did, and that path exists precisely as the way back in when
Firebase is unreachable. Live updates therefore belonged to whoever had
arrived through Google — and on an iPhone, where One Tap never draws
(`oneTapAvailable` returns `!isIos()`), the password form is the path of least
resistance. The same person could see somebody typing on a laptop and not on
their phone, with nothing on screen to say why. Even a Google session does not
last: Safari clears site data after a week idle, and a home-screen app keeps
its own, while this app's cookie outlives both.

So the server vouches instead. In the browser, `provider.ts` does this:

```
realtimeOff()
  │
  ├─ await auth.authStateReady()   → wait for Firebase to restore from storage
  ├─ currentUser?  ───────────────→ yes: on
  └─ adopt(auth)                   → at most once per page
       ├─ realtimeToken()          → server action; the cookie is the credential
       │    null  ────────────────→ off, and the console says why, once
       └─ signInWithCustomToken    → on
```

The wait matters. Firebase restores a session asynchronously, so for the first
few hundred milliseconds of a page `currentUser` is null even for somebody who
is signed in. Deciding then would conclude "no session" on a fresh load, and
nothing asks again — the room would sit on the slow floor for as long as it
stayed open.

`realtimeToken` (`src/server/actions/realtime.ts`) mints a Firebase custom
token for the session it has already authenticated by cookie. The uid is
chosen server side, so a browser cannot ask to be somebody else — the Firebase
uid Google sign-in already minted when there is one, so the two paths land on
the same Firebase user, and otherwise the app's own id, which is a uuid and
cannot collide with a Firebase uid. `speakersOf` picks the same uid by the
same rule; if those two ever disagree, a typing document lands under a name no
reader recognises and the indicator simply never draws.

The token lives **55 minutes** — Firebase refuses anything over an hour, and
the gap leaves room for clock skew. It only has to survive the exchange: once
traded, the session is Firebase's own and refreshes itself. The browser asks
for one **at most once per page load**; a second attempt would fail for the
same reason as the first.

This hands out no authority the project had not already given away: the rules
read `request.auth != null`, and the project's sign-in is not gated by the
app's allowlists, so that already meant any Google account on the internet.
What keeps a room private is the 122-bit channel key.

Without the service account nothing breaks — the token comes back null, the
console says so once, and the room falls back to asking on the slow floor, the
same as before.

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

## Notifications

A doorbell reaches a tab that is open. A notification reaches a phone that is
face down, which is the other half of the same problem.

FCM itself is free on the Spark plan — unlimited messages, no overage. What it
costs is in two other places.

### Data-only, and why

Every message is sent **without** a `notification` block. One carrying it is
drawn by the browser, so the words are fixed at send time and cannot be
shortened, replaced or collapsed on the device. Data-only hands the payload to
the service worker and `sw.js` draws it — which is also what keeps the Firebase
SDK out of that file. It is plain JS with no build step on purpose, and
`importScripts` of a compat bundle would end that.

The price is a rule that must not be broken: **a push event has to end in a
visible notification.** A browser receiving pushes that show nothing revokes
the permission, so every path in the `push` handler calls `showNotification`,
including the one for a payload it cannot parse.

### iOS, again

**iOS delivers web push only to an app added to the Home Screen.** Not Safari,
not Chrome — the same WebKit underneath, and neither issues a token. So the
settings card checks for an installed app *before* it checks the permission: an
iPhone in Safari reports `default` and then delivers nothing, and asking
somebody to allow notifications there sends them to do something that cannot
work. What they get instead is the install steps.

FCM also rotates tokens on its own, with reports of it doing so on iOS after a
handful of notifications. `PushRefresh` re-registers on every load of the shell
for that reason — a token stored once, at the moment somebody pressed the
button, is a device that quietly stops being reachable with nothing to see.

### Permission is not the same as on

Two facts, and conflating them breaks both directions. The browser permission
is granted once and a page cannot take it back. This app's own record —
`medaily.push.enabled`, per browser — is what "on" means here.

Without the second, "turn off" would leave a button that still said turn off,
and the silent refresh on the next load would register the device again,
undoing what somebody had just asked for.

Signing out clears the record and deletes the row. Otherwise the previous
person keeps buzzing that phone until somebody signs in and the token changes
owner — and a token moving owner is exactly what `push_devices_token_uniq`
exists for.

### What it needs

`NEXT_PUBLIC_FIREBASE_VAPID_KEY` (Firebase Console → Project settings → Cloud
Messaging → Web configuration), and `FIREBASE_SERVICE_ACCOUNT` widened to
`roles/firebasemessaging.admin` on top of `roles/datastore.user`. Unset, the
card never appears and chat works exactly as before.

A token FCM refuses with 404 or 403 is deleted on the spot rather than retried
nightly: it is dead for everyone, not just for this send.

---

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
