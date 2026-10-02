---
title: Goals
description: Longer arcs you pursue over time — set by hand, kept by a daily-log metric, or broken into milestones — with pace against a deadline.
sidebar_position: 5
---

# Goals

A goal is a longer arc than a habit: something you pursue over weeks or months and want a sense of progress on. Progress comes in one of three shapes — a percentage you set, a daily-log metric that keeps itself, or milestones you tick off — and with a deadline the card tells you whether you are on pace.

| | |
| --- | --- |
| **Where** | `/goals` · sidebar → Core → Goals · **Goals** card on the [dashboard](./dashboard.md) |
| **Works offline** | No |
| **Needs** | Nothing extra; drafting a goal from a sentence needs `AI_SERVICE_URL` — see [Configuration](../operations/configuration.md) |

## Rules

- A goal tracks progress one of three ways: **Manual** (you set the percentage), **Metric** (it keeps itself from the daily log) or **Milestones** (you tick them off).
- A metric goal needs a metric, a way to total it, a window, a target above zero, and whether the target is a floor or a ceiling.
- Milestones typed into the form each count the same.
- With a deadline, the card shows days left, **Ahead**, **On track** or **Behind**, and the rate per day still needed to finish on time.
- The deadline cannot be before the start date.
- Completed goals always sit below active ones; your own order applies within each status.
- Your order is saved and follows you to another device.
- A project can be attached to a goal.
- A goal drafted from quick capture lands in the form for you to check. A metric it invented, or a deadline in the wrong century, is dropped first.
- Turning off the daily-log field a metric goal reads stops that goal counting.

## Create a goal

1. Open **Goals** and press **New goal**.
2. Give it a name, a category (career, health, finance, knowledge or life), a priority (low, medium or high), a start date and, if you want one, a deadline. Leave the deadline empty for none.
3. Under **How progress is measured**, choose:
   - **I set the percentage myself** (Manual) — enter **Progress now (%)**.
   - **From a number I log** (Metric) — see [Track a goal by a metric](#track-a-goal-by-a-metric).
   - **From milestones** (Milestones) — type them one per line.
4. Save.

## Track a goal by a metric

For example, "300 study minutes a week".

1. In the goal form, choose **From a number I log**.
2. Pick the **Metric** — under **What the app measures** for a built-in field, or **Your own** for [an activity you added](./daily-log.md#add-your-own-activity).
3. Under **Combine how**, choose how to total it: **Total** (sum), **Average**, **Days with any** (days done) or **Latest value**.
4. Under **Over**, choose the window the target applies to: **The whole goal**, **Each week** or **Each month**.
5. Enter the **Target**. It must be above zero.
6. Under **Direction**, say whether the target is a floor (**At least the target**) or a ceiling (**At most the target**).
7. Check the preview line ("Progress = … of … , target …") and save. Progress now keeps itself as you log days.

## Tick off a milestone

1. On the goal's card, tick the milestone.

## Update a manual goal

1. Open the goal and set the new percentage.

## Reorder your goals

1. Drag a card by the handle on its left.
2. Or focus the handle (with `Tab`) and use the arrow keys.

The order is saved and follows you to another device.

## Attach a project

1. Open the [project](./projects.md) and press **Edit**.
2. Under **Linked goal**, pick this goal, and save.

## Draft a goal from a sentence

1. Open quick capture (`⌘J`, or the **Capture** launcher) — see [Assistant](./assistant.md).
2. Describe what you want in a sentence.
3. Check the draft that lands in the goal form, change anything, and save.

## Archive a goal

1. Open the goal's edit dialog.
2. Press **Archive**. The goal is put away.

## How it works

**Metric goals read the log.** A metric goal totals a daily-log field over its window. Study and deep-work minutes are the numbers resolved from your [timer](./timer.md) sessions, the same ones every other page reads, so progress cannot drift from what you timed. Days you did not log are *not recorded*, not zero.

**Pace.** With a deadline, the card compares your progress with the share of the time between the start date and the deadline that has gone by. Ten percentage points or more ahead of that share is **Ahead**, ten or more behind is **Behind**, and anything between is **On track** — the ten-point band keeps the label from flickering day to day. A goal with no progress figure yet says **Not started**, and one with no deadline says **No deadline**. It also shows the days left and the rate per day still needed to finish on time.

**Order.** The list is yours to arrange, but status comes first: completed goals still sink below active ones, and the arrangement applies within each status.

**Work connects to intent.** A [project](./projects.md) names the goal it serves. That is how the work you do — tasks, and time timed against the project — connects to what you are aiming at.

**Quick capture is checked, not trusted.** A goal drafted from a sentence is cleaned before the form sees it: a metric that does not exist, or a deadline in the wrong century, is dropped. Nothing is saved until you press save.

**When a field is turned off.** Under [daily log **Set up**](./daily-log.md#choose-which-fields-the-form-asks), each built-in field says how many goals read it, because a goal stops counting when its field is off.

**What changed.** Adding, changing, archiving or deleting a goal is recorded in **What changed** in [Settings](./settings.md).

## Related

- [Daily log](./daily-log.md) — the fields a metric goal totals; your own activities work too
- [Projects](./projects.md) — a project is attached to the goal it serves
- [Timer](./timer.md) — timed sessions supply study and deep-work minutes, and project time
- [Habits](./habits.md) — the short-cycle counterpart, bound to the same metrics
- [Dashboard](./dashboard.md) — the **Goals** card, and "a goal off pace" in **Worth noticing**
- [Assistant](./assistant.md) — drafting goals from a sentence, and **Goals & to-dos**
- [Settings](./settings.md) — the **What changed** trail
- [Navigation](../get-started/navigation.md) — the command palette searches goals
- [First days](../get-started/first-days.md) — "Set one goal" on the checklist
- [Keyboard shortcuts](../get-started/keyboard-shortcuts.md) — `g` then `g` jumps here
- [Data model: habits and goals](../reference/data-model/habits-and-goals.md) — `goals` and `goal_milestones`
