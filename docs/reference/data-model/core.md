---
title: Core tables
description: The account tables — users, user_settings, auth_identities and push_devices — that every other table and every page depends on.
sidebar_position: 2
---

# Core tables

Four tables describe the person rather than anything they record: the account, the settings the app reads before it can render, the ways they sign in, and the browsers that can be notified. Columns shared by every table (`id`, `user_id`, timestamps) are described once in [Data model](./overview.md).

## `users`

The account. One row per person; the app was single-user first, so a fixed owner id (`00000000-0000-4000-8000-000000000001`, with its `user_settings` row) is inserted by `drizzle/views.sql` after every migration run — `ON CONFLICT DO NOTHING`, so it is never duplicated — and still owns everything written then.

| Column | Type | Notes |
| --- | --- | --- |
| `display_name` | text, not null | Defaults to `'Me'` |
| `email` | text | From the Google profile; unique case-insensitively (`lower(email)`) where present. The owner row has none |
| `image_url` | text | Google avatar |

Every other Postgres table points here through `user_id` with `ON DELETE CASCADE`, so deleting the user deletes everything they own.

## `user_settings`

One row per user, created on first use. Everything the app reads before it can render: the clock, the palette, the maths.

| Column | Type | Notes |
| --- | --- | --- |
| `locale` | enum `en`/`vi` | Mirrored into a cookie so the first server render is already right |
| `timezone` | text | Default `Asia/Ho_Chi_Minh` |
| `day_rollover_hour` | smallint | Default `4`. A log written at 01:00 belongs to the previous day — this is why |
| `week_start` | enum `monday`/`sunday` | Drives every weekly range |
| `theme` | text | Free text validated against the registry in `lib/themes.ts`, so a new theme needs no migration |
| `density`, `accent` | text | Presentation only |
| `unit_system` | enum `metric`/`imperial` | |
| `default_currency` | text | Default `VND` |
| `score_weights`, `score_targets` | jsonb | Merged **over** the defaults on read, so a partially written blob can never produce an undefined target |
| `streak_thresholds` | jsonb | What counts as "done" for a streak, per metric |
| `streak_grace_enabled` | boolean | One missed day does not break a streak |
| `insight_thresholds` | jsonb | When a rule-generated observation is worth showing |
| `reminder_time` | time | Default `21:00` |
| `notification_prefs`, `dashboard_cards` | jsonb | |
| `hidden_daily_fields` | jsonb | Daily-log fields the form stops asking for (`0017`). **Hidden, never deleted**: the column and its history stay, the field is just not offered |
| `onboarding` | jsonb | Only `tourSeenAt` and `checklistDismissedAt`. Progress itself is derived from real rows, so the checklist cannot claim something the database does not contain |
| `shortcuts` | jsonb | **Only the keys the user changed**; the rest come from the registry, so a default can change later for everyone who never touched it |

## `auth_identities`

How a user signs in. A user can hold several.

| Column | Type | Notes |
| --- | --- | --- |
| `provider` | enum | `password` (the env credential pair) or `google` |
| `provider_uid` | text | Unique with `provider`. The Firebase uid, or the username |
| `email` | text | As the provider reported it |
| `last_login_at` | timestamptz | |

The `google` row's `provider_uid` is also the Firebase uid live updates use to name a typing claim: `speakersOf` reads it, and falls back to the person's own id when there is no Google identity. See [Typing indicator](../realtime/typing-indicator.md) and [Who Firestore thinks you are](../realtime/setup.md).

## `push_devices`

Where a person's notifications can reach them. One row per browser that asked for them — a phone and a laptop are two.

Keyed by the **token**, not by `(user_id, token)`. FCM hands the same string back to whoever registers the same browser, so after a sign-out and a sign-in by somebody else the row has to change owner rather than be joined by a second one; getting that wrong sends one person's notifications to the other's phone. The unique index that enforces this is `push_devices_token_uniq`.

Cascades with the user, which is what keeps account removal from having to remember it.

| Column | Type | Notes |
| --- | --- | --- |
| `token` | text, not null | Unique. The FCM registration token — the address |
| `user_agent` | text | Only to tell two rows apart; never trusted |
| `last_seen_at` | timestamptz | Moved forward each time the browser confirms the token |

Signing out deletes the row for that browser, and a token FCM refuses with 404 or 403 is deleted on the spot. See [Push notifications](../realtime/push-notifications.md).

## Related

- [Data model](./overview.md) — conventions shared by every table
- [Sign in](../../get-started/sign-in.md) — writes `auth_identities` and creates `users`
- [Settings](../../features/settings.md) — reads and writes `user_settings`: locale, timezone, rollover hour, theme, units, currency, delete account
- [First days](../../get-started/first-days.md) — the tour and checklist state in `user_settings.onboarding`
- [Keyboard shortcuts](../../get-started/keyboard-shortcuts.md) — customised keys in `user_settings.shortcuts`
- [Dashboard](../../features/dashboard.md) — `dashboard_cards`, `score_weights`, `score_targets`
- [Daily log](../../features/daily-log.md) — `day_rollover_hour` and `hidden_daily_fields`
- [Habits](../../features/habits.md) — `streak_thresholds` and `streak_grace_enabled`
- [Notifications](../../features/notifications.md) — the user-facing side of `push_devices`, `reminder_time` and `notification_prefs`
- [Push notifications](../realtime/push-notifications.md) — how `push_devices` rows are registered, refreshed and dropped
- [Who Firestore thinks you are](../realtime/setup.md) — how `auth_identities` decides the Firebase uid
