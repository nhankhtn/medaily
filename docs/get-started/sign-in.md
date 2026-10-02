---
title: Sign in
description: The public welcome page, the legal pages, and how signing in works — password or Google, who is let in, and how long a session lasts.
sidebar_position: 1
---

# Sign in

medaily is a personal life-tracking app: one daily log, and everything else built from it. Before you can use it you sign in, either with the instance's username and password or with Google. This page covers what you see before signing in, how to sign in, and who the app lets in.

| | |
| --- | --- |
| **Where** | `/welcome` (public), `/login`, `/legal/terms`, `/legal/privacy` |
| **Works offline** | No |
| **Needs** | Google sign-in needs `NEXT_PUBLIC_FIREBASE_*`; One Tap also needs `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — see [Configuration](../operations/configuration.md) |

## Rules

- Opening the bare address without a session shows the welcome page; opening any other address shows sign-in, and you return to that address afterwards.
- Only `/welcome`, `/legal/terms` and `/legal/privacy` can be read without signing in, and only those may be indexed by search engines.
- The default is closed: with no allowlists and signup off, only the owner gets in.
- An empty allowlist does not mean "allow everyone". With no lists at all, turning signup on is what opens the door; with a list, signup only lets people on the list create a workspace.
- Too many sign-in attempts from one place within 15 minutes and you are asked to wait.
- A session lasts 30 days and is renewed as you open pages, but ends six months after the sign-in that started it, however often it was renewed.
- Signing out clears everything of yours the device is holding, including daily-log days not yet sent.

## Read about the app before signing in

1. Open the app's bare address without being signed in. You land on `/welcome`.
2. Read what the app is: the modules in a sentence each, and the promise about data.
3. Use the language and theme switches on the page if you want; the welcome page has its own.
4. Open the links to the **terms** (`/legal/terms`) and the **privacy** note (`/legal/privacy`).
5. To send a note to whoever runs the instance, press **Contact**. It is there only where a support channel is configured, and it opens the same form as **Get in touch** in [Settings](../features/settings.md).
6. Press **Get started** to go to sign-in.

## Sign in with a username and password

1. On the sign-in page, enter the username and password.
2. Press the sign-in button.

The username and password are the credential pair set in the environment (`AUTH_USERNAME`, `AUTH_PASSWORD`). This is also the only account that can open the owner-only documentation site; see [Docs site](../operations/docs-site.md).

## Sign in with Google

1. On the sign-in page, press the Google button. It appears only when Google sign-in is configured.
2. Choose your Google account.

If a Google account has signed in on this device before, the page offers it as **Continue as** *its address* — press it to sign in with one tap. Where the browser supports it, Google's One Tap prompt offers the same.

## Forget a remembered account

1. On the sign-in page, find the **Continue as** *address* row.
2. Press **Forget this account** beside it.

## Sign out

1. On a computer, use sign-out in the header. On a phone, open **More** in the dock and press sign-out. See [Navigation](./navigation.md).

> **Important:** Signing out clears the daily-log page cached for offline use, any days still waiting to be sent, and drafts of days you typed but never saved. If you have days waiting, get a connection before you sign out. See [Daily log](../features/daily-log.md#how-it-works).

## How it works

**Why there is a welcome page.** Someone who opens the bare address may never have heard of the app, and a sign-in form tells them nothing. So the bare address goes to `/welcome`, which says what the app is. Any other address goes to sign-in instead, as `/login?next=…`, and you return to that address afterwards — someone following a link to a note has been sent somewhere, and should end up there.

**Why the legal pages are public.** `/legal/terms` and `/legal/privacy` are what a person reads before handing over a journal and a ledger. A page you have to sign up to read cannot inform that decision. They are the only pages besides `/welcome` that search engines may index.

**Who may sign in.** Either the credential pair from the environment, or Google. Who may sign in is controlled by four variables:

| Variable | Effect |
| --- | --- |
| `AUTH_OWNER_EMAIL` | A Google sign-in with this address links to the existing owner account instead of getting a new, empty workspace |
| `AUTH_ALLOWED_EMAILS` | Comma-separated addresses allowed in |
| `AUTH_ALLOWED_DOMAINS` | Comma-separated email domains allowed in |
| `AUTH_ALLOW_SIGNUP` | `true` lets someone who passes the lists create a workspace; without it, only addresses already known to the database |

The default is **closed**. Empty lists with signup off means only the owner gets in. This app holds a journal, health records and finances, and leaving registration open because the URL happens to be public is not a default worth shipping.

An empty allowlist does not mean "allow everyone": with no lists at all, `AUTH_ALLOW_SIGNUP=true` is what opens the door. Add a list and that switch changes meaning — it then only lets people *on the list* create a workspace.

**One Tap.** Google's One Tap prompt is never loaded on iOS, where it could not draw anything.

**Rate limit.** Too many attempts from one place in 15 minutes and the page asks you to wait.

**Staying signed in.** A session lasts 30 days and is renewed as you open pages, so someone who uses the app most weeks is not signed out. It ends six months after the sign-in that started it, however often it was renewed.

## Related

- [First days](./first-days.md) — what a new account sees after its first sign-in
- [Navigation](./navigation.md) — where sign-out lives on a computer and on a phone
- [Settings](../features/settings.md) — shows how you signed in and since when; **Get in touch** is the form behind **Contact**; **Delete this account** asks you to type your username or Google address
- [Daily log](../features/daily-log.md) — signing out drops days still waiting to be sent
- [Notifications](../features/notifications.md) — turned on per device, after signing in
- [Configuration](../operations/configuration.md) — the `AUTH_*`, Firebase, Google client and Telegram variables
- [Docs site](../operations/docs-site.md) — the `/docs` site only the credential-pair account can open
- [Realtime setup](../reference/realtime/setup.md) — how a password sign-in is given a Firestore identity
- [Data model: core](../reference/data-model/core.md) — `users`, `auth_identities` and the tables behind accounts
