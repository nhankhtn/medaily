---
title: First days
description: The introduction tour, the Getting started checklist on the dashboard, and adding the app to your home screen.
sidebar_position: 2
---

# First days

A new account opens on a short tour, and the dashboard carries a checklist until you have tried the parts that matter. Nothing is required — the daily loop works on its own, and every other module is there when it earns its place.

| | |
| --- | --- |
| **Where** | Tour: starts on first sign-in · Checklist: the [dashboard](../features/dashboard.md) (`/`) · Replay: **Settings → Show the introduction again** |
| **Works offline** | No |
| **Needs** | Nothing extra |

## Rules

- A new account opens on an eight-step tour; **Skip** ends it at any step.
- On a device that can install the app, the end of the tour asks once whether to add it to the home screen.
- The Getting started checklist stays on the dashboard until every line is done, or until you press **Hide this**, which puts it away for good.

## Take the tour

1. Sign in for the first time. The tour starts on its own.
2. Follow it from page to page. Each step points at the one control on that page worth knowing.
3. Press **Skip** at any step to end it early.
4. On a device that can install the app, answer the question at the end about adding it to the home screen.

## Replay the tour

1. Open [Settings](../features/settings.md).
2. Press **Show the introduction again**.

## Work through Getting started

The dashboard shows a **Getting started** checklist. Each line ticks itself when you have done it:

1. **Log today** — fill and save today on the [daily log](../features/daily-log.md).
2. **Create one habit** — see [Habits](../features/habits.md).
3. **Set one goal** — see [Goals](../features/goals.md).
4. **Log three days** — three saved days on the daily log. [Catch-up](../features/daily-log.md#catch-up-on-missed-days) can fill missed ones.
5. **Write a weekly review** — see [Reviews](../features/reviews.md).

To put the checklist away before it is done, press **Hide this**. It does not come back.

## Add the app to your home screen

1. At the end of the tour, accept the offer to add it — or later, open [Settings](../features/settings.md) and press **Add to home screen**. The button is there only where the browser can install the app and it is not installed yet.
2. On an iPhone, Safari has no button for it, so Settings shows the two taps to make instead. Follow them.

Installed, the app opens without the address bar, and anything saved offline is safe from being cleared. With no browser bar, the header gains a **Reload** button — see [Navigation](./navigation.md).

## How it works

The tour visits eight pages in order — the dashboard, the daily log, habits, goals, the timer, notes, finance and settings — pointing at one control on each rather than explaining everything. The rest of these docs cover the detail.

The checklist lines are the smallest version of the daily loop: one day logged, one habit, one goal, a few days of history, and one look back. Once every line is done, the checklist goes away by itself.

Progress is worked out from what you have actually saved — days logged, habits, goals, reviews — rather than stored as ticks, so the checklist cannot claim something the database does not contain. Only two things are remembered: that you have seen the tour, and that you pressed **Hide this**.

## Related

- [Sign in](./sign-in.md) — the tour starts after the first sign-in
- [Navigation](./navigation.md) — the sidebar, the phone dock and the **Reload** button an installed app gets
- [Dashboard](../features/dashboard.md) — where the Getting started checklist lives
- [Daily log](../features/daily-log.md) — "Log today" and "Log three days"; offline saving works best installed
- [Habits](../features/habits.md) and [Goals](../features/goals.md) — "Create one habit" and "Set one goal"
- [Timer](../features/timer.md), [Learning](../features/learning.md) and [Finance](../features/finance/overview.md) — pages the tour stops on
- [Reviews](../features/reviews.md) — "Write a weekly review"
- [Settings](../features/settings.md) — **Show the introduction again** and **Add to home screen**
- [Notifications](../features/notifications.md) — on an iPhone, notifications need the app installed to the home screen
- [Data model: core](../reference/data-model/core.md) — `user_settings.onboarding`, which remembers only that the tour was seen and the checklist hidden
