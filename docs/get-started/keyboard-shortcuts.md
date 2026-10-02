---
title: Keyboard shortcuts
description: Every keyboard shortcut, where each one works, and how to change them.
sidebar_position: 4
---

# Keyboard shortcuts

Most things you do every day have a key: search, quick capture, moving between days on the daily log, saving, starting the timer. Every shortcut can be changed, and your changes follow you to another device.

| | |
| --- | --- |
| **Where** | Press `?` anywhere · the keyboard button next to the **Capture** launcher · [Settings](../features/settings.md) → **Keyboard shortcuts** |
| **Works offline** | No |
| **Needs** | Nothing extra; `⌘J` needs `AI_SERVICE_URL` — see [Configuration](../operations/configuration.md) |

## Rules

- Every shortcut is editable; conflicts are refused.
- Bare keys (no `⌘`/`Ctrl`) do nothing while the cursor is in a text field, so typing an `s` never saves the day.
- `⌘K` and `⌘J` work even while you are typing; `⌘B` does not, because in the editor it means bold.
- Escape, the arrows, Enter and the digits cannot be given away as bare keys.
- Changed keys follow you to another device.
- Settings does not offer the shortcut list on a phone.

## Default shortcuts

`⌘` means `Ctrl` on Windows and Linux. A sequence like `g` then `d` means press `g`, let go, then press `d`.

| Where | Key | Does |
| --- | --- | --- |
| Anywhere | `⌘K` | Open the command palette and search — see [Navigation](./navigation.md#search-everything) |
| Anywhere | `⌘J` | Open quick capture — see [Assistant](../features/assistant.md). Only when the AI service is configured |
| Anywhere | `?` | Show this list |
| Anywhere | `⌘B` | Fold the sidebar away, or bring it back |
| Jump to | `g` then `o` | Home ([dashboard](../features/dashboard.md)) |
| Jump to | `g` then `d` | [Daily log](../features/daily-log.md) |
| Jump to | `g` then `h` | [Habits](../features/habits.md) |
| Jump to | `g` then `g` | [Goals](../features/goals.md) |
| Jump to | `g` then `a` | [Analytics](../features/analytics.md) |
| Jump to | `g` then `s` | [Settings](../features/settings.md) |
| On the daily log | `[` | Previous day |
| On the daily log | `]` | Next day |
| On the daily log | `T` | Today |
| On the daily log | `S` | Save |
| On the timer | `Space` | Start or pause — see [Timer](../features/timer.md) |

The daily-log keys work on the daily log only, and the timer key on the timer only.

## Open the shortcut list

1. Press `?` — or press the keyboard button next to the **Capture** launcher in the bottom corner (on a computer), or open [Settings](../features/settings.md) and go to **Keyboard shortcuts**.

## Change a shortcut

1. Open the shortcut list.
2. Click the key you want to change.
3. Press the new key, or a two-key sequence.
4. If the new key is already taken, the change is refused; pick another.

The change is saved to your account and applies on every device you sign in on.

## How it works

**Bare keys and typing.** A key with no modifier is off while the cursor is in a text field, so typing an `s` into a note never saves the day out from under you. A key held with `⌘` normally still works mid-sentence — a palette that refuses to open while you type is a palette people stop reaching for. `⌘B` is the exception: in the editor those keys mean bold, so it does nothing while the cursor is in a text field.

**Keys you cannot rebind.** Escape, the arrows, Enter, Tab, Backspace and the digits stay fixed as bare keys. They are controls, not preferences: Escape closes things, the arrows and Enter drive every list, and a bare digit would swallow the 1–10 scores on the daily log. Held with `⌘`, they can be bound, since the modifier makes them unambiguous.

**What is stored.** Only the keys you changed are saved; the rest come from the defaults. So if a default changes later, everyone who never touched that key gets the new one.

**Phones.** The shortcut list is a keyboard's business, so Settings does not offer it on a phone.

**Other keys.** On [Goals](../features/goals.md), a focused drag handle moves a card with the arrow keys. These are part of the page, not shortcuts, and are not in the list.

## Related

- [Navigation](./navigation.md) — the command palette behind `⌘K`, the sidebar behind `⌘B`, and the keyboard button
- [Daily log](../features/daily-log.md) — `[`, `]`, `T` and `S`
- [Timer](../features/timer.md) — `Space`
- [Assistant](../features/assistant.md) — quick capture behind `⌘J`
- [Editor](../features/editor.md) — why `⌘B` stays out of the way of bold
- [Settings](../features/settings.md) — where the list lives on a computer
- [Data model: core](../reference/data-model/core.md) — `user_settings.shortcuts`, which holds only the keys you changed
