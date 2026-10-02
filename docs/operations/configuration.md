---
title: Configuration
description: Every environment variable the app reads, which feature each one switches on, and what you get without it.
sidebar_position: 1
---

# Configuration

The app is configured entirely through environment variables. A handful are
required; everything else switches on an optional service, and is off unless
set. `.env.example` lists every variable the app reads — it is a map of what
exists rather than a pile of things you have to know to look for.

## Rules

- A blank value means *not set*: the feature behind it stays switched off and nothing about it is validated.
- `DATABASE_URL`, `AUTH_USERNAME`, `AUTH_PASSWORD` and `AUTH_SECRET` are required. Without all three `AUTH_*` values the app refuses every request except `/api/health` — a misconfigured deploy must never be open.
- Every optional service is off unless configured, and the UI mostly hides rather than breaks.
- `NEXT_PUBLIC_*` variables are baked into the browser bundle at **build** time; changing one on the host needs a redeploy.
- Sign-in is closed by default: with no allowlists and signup off, only the owner gets in.
- Every variable the app validates must be named in `.env.example`, and nothing else may be — a unit test checks both directions.

## Set up a new deployment

1. Copy `.env.example` to `.env.local` (or set the same names on the host).
2. Fill in `DATABASE_URL`, `AUTH_USERNAME`, `AUTH_PASSWORD`, and `AUTH_SECRET` (make one with `openssl rand -hex 32`).
3. Decide who may sign in: set `AUTH_OWNER_EMAIL`, and the allowlists or `AUTH_ALLOW_SIGNUP` if anyone else should get in.
4. Add the optional services you want from the table below. Leave the rest blank.
5. Build and deploy. If you changed any `NEXT_PUBLIC_*` value, rebuild.

## Add a new variable

1. Validate it in `src/lib/env.ts`.
2. Add an uncommented `NAME=` line to `.env.example`, with a comment saying what it switches on and what happens without it.
3. Run the unit tests: `tests/unit/env-example.test.ts` fails if the schema and the example disagree.

## Optional services

Everything below is off unless configured; the table says what you get without
each one.

| Service | Variables | Without it |
| --- | --- | --- |
| Google sign-in | `NEXT_PUBLIC_FIREBASE_*`; One Tap also needs `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | The Google button does not appear — see [Sign in](../get-started/sign-in.md) |
| AI service | `AI_SERVICE_URL` / `AI_SERVICE_TOKEN` (`medaily-ai`) — see [AI service](../reference/ai-service/overview.md) | No narrative on [Reviews](../features/reviews.md), and no quick capture or [assistant](../features/assistant.md) — the launcher and `⌘J` are not offered, so finance, goals and to-dos are entered through their own forms |
| Pictures | `CLOUDINARY_*` | Galleries under [People](../features/people.md) are hidden; profile photos and [group pictures](../features/chat/rooms-and-invites.md) say storage is not set up; pictures pasted into the [editor](../features/editor.md) do not upload |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Errors go to the console only; no Get in touch form, in [Settings](../features/settings.md) or on `/welcome`; no nightly report |
| Nightly job | `CRON_SECRET` | The job refuses to run: [budgets](../features/finance/budgets.md) are not carried forward on their own (**Copy last month** still works), and unused pictures stay. The evening reminder does not run either — see [Scheduled jobs](./scheduled-jobs.md) |
| Activity trail | `MONGODB_URI`, `ACTIVITY_LOG_DAYS` | No What changed, and no **See history** in [Settings](../features/settings.md) |
| Chat | `MONGODB_URI` | [Chat](../features/chat/overview.md) still appears in the nav, but its pages answer 404 |
| Locked messages | `CHAT_MESSAGE_KEY`, `CHAT_MESSAGE_KEY_SPARE` | Messages are stored as plain text in Mongo — see [Chat privacy](../features/chat/privacy.md) |
| Live updates | `NEXT_PUBLIC_REALTIME_ENABLED=1` (read at build time), `FIREBASE_SERVICE_ACCOUNT` | Chat checks for new messages on a slow timer instead. The service account lets a password sign-in listen too, and is what the nightly sweep uses — see [Live updates setup](../reference/realtime/setup.md) |
| Push notifications | `NEXT_PUBLIC_FIREBASE_VAPID_KEY`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `FIREBASE_SERVICE_ACCOUNT` | The Notifications card never appears; chat still works, it just does not reach a phone that is put down — see [Notifications](../features/notifications.md) |
| Web analytics | `NEXT_PUBLIC_ANALYTICS_ENABLED` | Vercel Web Analytics and Speed Insights stay off |

## Every variable

### Required

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `AUTH_USERNAME`, `AUTH_PASSWORD` | The credential pair for password sign-in. This account is the only one that can open the [`/docs` site](./docs-site.md). |
| `AUTH_SECRET` | Signs sessions. Make one with `openssl rand -hex 32`. |
| `NODE_ENV` | Node environment. |

### Site

| Variable | What it switches on |
| --- | --- |
| `SITE_URL` | The address people actually paste, used for the link preview card and for `robots.txt`. On Vercel the project's own production hostname is used when this is blank, so it only needs filling in for a custom domain. |
| `LEGAL_CONTACT_EMAIL` | A second way to reach you, named in the privacy notice beside the contact form. Blank and the notice points at the form alone, which is on the front page and needs no account. Do not put a personal address here: that page is indexed. |
| `NEXT_PUBLIC_ANALYTICS_ENABLED` | Vercel Web Analytics and Speed Insights. Off unless set, so nothing counts a developer or reports from a build that is not on Vercel. Turning it on changes what the privacy notice has to say. |

### Who may sign in

| Variable | What it does |
| --- | --- |
| `AUTH_OWNER_EMAIL` | The owner's Google address. It links to the existing owner row instead of creating a new one. |
| `AUTH_ALLOWED_EMAILS` | Comma-separated addresses allowed in. |
| `AUTH_ALLOWED_DOMAINS` | Comma-separated domains allowed in. Either list is enough to be let in. |
| `AUTH_ALLOW_SIGNUP` | `true` lets a permitted address create its own workspace. With no lists at all, this is what opens the door to everyone; add a list and it only lets people *on the list* create a workspace. |

Left blank, only the owner can sign in: an unknown Google account is refused
rather than handed a new workspace. An empty allowlist does not mean "allow
everyone". See [Sign in](../get-started/sign-in.md).

### Google sign-in (Firebase)

| Variable | What it does |
| --- | --- |
| `FIREBASE_PROJECT_ID` | The only Firebase value needed server-side: ID tokens are verified against Google's public keys, so there is no service account file and no extra secret for sign-in. |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase web config. Not secrets — it identifies the project, it does not authorise anything. Also used by live updates. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | The auth domain is the *app* host at run time; keep this as the Firebase default for local tooling. Production Google OAuth must also allow `https://<your-app>/__/auth/handler`. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app id. Sign-in works without it, but notifications need it: without it, registering a device fails as `installations/missing-app-config-values`, saying nothing about push. |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Analytics only. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google One Tap. The OAuth *web* client id; every origin the app is served from must be listed under Authorized JavaScript origins, or Google silently draws nothing (`localhost` and `127.0.0.1` count as different origins). One Tap never works on iOS, where the remembered-account chips are the shortcut instead. |

### AI service

| Variable | What it does |
| --- | --- |
| `AI_SERVICE_URL`, `AI_SERVICE_TOKEN` | Where `medaily-ai` lives and how to authenticate to it. It answers quick capture, the review chat, the written AI review and the assistant. Without it none of them is offered and every manual form works exactly as before. The provider keys and the model chain live in that service, not here. See [AI service](../reference/ai-service/overview.md). |

### Live updates and notifications

| Variable | What it does |
| --- | --- |
| `NEXT_PUBLIC_REALTIME_ENABLED` | `1` turns on chat updates through Firestore. Read at build time. Blank and chat still works, checking again on a slow timer. |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | The Web Push certificate key, from Firebase Console → Project settings → Cloud Messaging → Web configuration. Public by design. |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | The project's sender id, from the same page. Needed as well as the key: set both or neither — one on its own gives a card that asks and then cannot finish. |
| `FIREBASE_SERVICE_ACCOUNT` | The whole service-account JSON on one line. Used by the nightly sweep of leftover live-update channels, by the custom token that gives a password sign-in a Firebase identity, and for sending notifications. Needs `roles/datastore.user`, plus `roles/firebasemessaging.admin` for notifications. Its `project_id` is checked against `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, so a staging key cannot delete from production. The only Firebase credential here with any power. |

Details, and troubleshooting, are in [Live updates setup](../reference/realtime/setup.md)
and [Push notifications](../reference/realtime/push-notifications.md).

### Second database (MongoDB)

| Variable | What it does |
| --- | --- |
| `MONGODB_URI` | Holds the activity trail and all of chat — rooms, members, invites and messages. Blank, neither is offered and the driver never connects. |
| `ACTIVITY_LOG_DAYS` | How long the activity trail is kept; 90 days when blank. Only the trail expires — a conversation that deleted itself after a while would be a bug, not a policy. |
| `CHAT_MESSAGE_KEY` | Locks the words of each chat message before they reach the database. Not end-to-end. Make one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. |
| `CHAT_MESSAGE_KEY_SPARE` | A second key that opens everything the first one does: the way back in when the main key is lost, and the way through a rotation. Set both before the first message. |

See [Chat privacy](../features/chat/privacy.md).

### Pictures (Cloudinary)

| Variable | What it does |
| --- | --- |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Photo storage. The secret signs uploads server-side; files go straight from the browser. Without these the photo UI stays hidden. |
| `CLOUDINARY_FOLDER` | Everything is filed under `<folder>/<userId>/<kind>/<ownerId>`. Defaults to `medaily` in the example. |

### Scheduled jobs and alerts

| Variable | What it does |
| --- | --- |
| `CRON_SECRET` | Sent back by the scheduler as `Authorization: Bearer $CRON_SECRET` on `/api/cron/nightly` and `/api/cron/reminders`. Blank and both refuse to run. See [Scheduled jobs](./scheduled-jobs.md). |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Crash alerts, the nightly report and the Get in touch form go to this Telegram chat. Make a bot with @BotFather, message it once, then read your chat id from `https://api.telegram.org/bot<token>/getUpdates`. Set these on the deploy rather than in `.env.local`, or every local typo buzzes your phone. |

### Debugging and platform

| Variable | What it does |
| --- | --- |
| `MEDAILY_SQL_DEBUG` | Outside production, any value logs every SQL query and its parameters to the console. Read directly, not through the schema, so it is not in `.env.example`. |
| `VERCEL`, `VERCEL_ENV`, `VERCEL_PROJECT_PRODUCTION_URL` | Set by Vercel itself; read, never set by hand. `VERCEL_PROJECT_PRODUCTION_URL` is the fallback for `SITE_URL`. |

## How it works

**Why a blank means off.** A blank value is treated as not set, so the feature
behind it stays switched off and nothing is validated. Filling in only what you
need is always a working configuration.

**Why closed by default.** This app holds a journal, health records and
finances, and leaving registration open because the URL happens to be public is
not a default worth shipping.

**Why the example file is tested.** `.env.example` is the only place anyone
finds out a variable exists. A variable the app reads and the example does not
name is a feature nobody can turn on — this once switched One Tap off with
nothing anywhere saying why. So `tests/unit/env-example.test.ts` checks that the
example names every variable the schema validates, and nothing the schema has
never heard of.

## Related

- [Scheduled jobs](./scheduled-jobs.md) — what `CRON_SECRET` and `TELEGRAM_*` turn on
- [Docs site](./docs-site.md) — the owner-only `/docs`, gated on `AUTH_USERNAME`
- [Sign in](../get-started/sign-in.md) — the `AUTH_*` allowlists and Google sign-in
- [Quick capture and the assistant](../features/assistant.md) — needs the AI service
- [Reviews](../features/reviews.md) — the written review needs the AI service
- [AI service](../reference/ai-service/overview.md) — the separate `medaily-ai` service behind `AI_SERVICE_URL`
- [Finance overview](../features/finance/overview.md) — quick capture and the budget carry-forward
- [Budgets](../features/finance/budgets.md) — carried forward by the nightly job
- [Chat overview](../features/chat/overview.md) — needs `MONGODB_URI`
- [Chat privacy](../features/chat/privacy.md) — `CHAT_MESSAGE_KEY`
- [Rooms and invites](../features/chat/rooms-and-invites.md) — group pictures need Cloudinary
- [Notifications](../features/notifications.md) — the push variables
- [People](../features/people.md) — galleries need Cloudinary
- [Editor](../features/editor.md) — pasted pictures need Cloudinary
- [Settings](../features/settings.md) — What changed and Get in touch need Mongo and Telegram
- [Live updates setup](../reference/realtime/setup.md) — `NEXT_PUBLIC_REALTIME_ENABLED` and Firestore rules
- [Push notifications](../reference/realtime/push-notifications.md) — what the push variables do underneath
- [Data model overview](../reference/data-model/overview.md) — Postgres, Mongo and Firestore, and what each holds
