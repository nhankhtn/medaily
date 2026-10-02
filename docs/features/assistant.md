---
title: Quick capture and the assistant
description: Ask about your own data in plain words, or file spending, goals and to-dos from a sentence — nothing is saved until you confirm.
sidebar_position: 18
---

# Quick capture and the assistant

Quick capture is one box, opened with `⌘J` or the **Capture** launcher. It opens on the **Assistant**: ask in your own words how the week went, what you spent, or what is still unfinished. Type `/` instead and the box reads a sentence into a form for you — a day's spending, a paragraph of goals and to-dos, or a conversation about how a period went. Nothing is written until you confirm.

| | |
| --- | --- |
| **Where** | `⌘J` anywhere · the **Capture** launcher in the bottom corner of every page |
| **Works offline** | No — it asks a model to read your sentence, so there is nothing to queue |
| **Needs** | The AI service: `AI_SERVICE_URL` / `AI_SERVICE_TOKEN` — see [Configuration](../operations/configuration.md) and [AI service](../reference/ai-service/overview.md). Without it neither `⌘J` nor the launcher is there |

## Rules

- Quick capture and the assistant need the AI service; without it they are not offered, and spending, goals and to-dos are entered through their own forms.
- Nothing is written until you confirm.
- Eight messages a minute; past that it asks you to wait.
- You pick where a note goes with `/`; the box does not guess.
- A to-do is finished once and ticked off; a goal is pursued over time and has a sense of progress.
- Where something could honestly be either a goal or a to-do, it comes back as a to-do.
- For goals and to-dos, only the text you typed leaves the machine — not your existing goals, not your tasks, not a number you have logged.
- **Looking back** is never sent journal entries, the body of notes, or other people's names.
- **Start over**, or closing the panel, ends the conversation.

## Ask the assistant

1. Press `⌘J`, or click the **Capture** launcher.
2. Ask in your own words, or tap a starter: *How did this week go?*, *What did I spend this month?*, *What is still unfinished?*, *How do I use this app?*
3. While it works, the panel says which step it is on and how it read the question (**Read as: …**). If the reading is wrong, rephrase.
4. Ask follow-ups in the same conversation. **Start over** clears it; closing the panel ends it too.

If what you typed is something to file rather than a question — spending, or a plan — the assistant says so and hands it to that form, already read, for you to check. An answer to a message that had an amount in it offers **File as spending**, in case it was meant as a record rather than a question.

## Log spending from a sentence

1. Open quick capture and type `/`.
2. Choose **Finance**.
3. Type a day's spending in one sentence — *"banh mi 30k this morning, coffee 25k, lunch 55k"*.
4. Check the proposed transactions, and confirm. Nothing is saved until you do.

A category's *note for AI*, set on Finance's Accounts tab, describes what belongs in it and helps quick capture pick the right one.

## Turn a paragraph into goals and to-dos

1. Open quick capture, type `/` and choose **Goals & to-dos**.
2. Write a paragraph of intentions.
3. The result comes back as a list split into goals to pursue and tasks to tick off.
4. Untick, edit and retype rows — including switching a row between goal and to-do, which is the call the split gets wrong most often.
5. Confirm. Goals are saved to [Goals](./goals.md); to-dos are saved as tasks with no project.

## Look back on a week or a month

1. Open quick capture, type `/` and choose **Looking back**.
2. Start from *This week*, *Last week* or *This month*, or ask a question.
3. Ask follow-ups — **Give me a few suggestions** is among them.

To leave a `/` choice and return to the assistant, press **Back to the assistant**.

## How it works

**Why the reading is shown.** **Read as: …** is shown on purpose: a question taken the wrong way is cheaper to rephrase than a wrong answer is to read.

**Why you pick with `/`.** The box lists where a note can go instead of guessing, so a note that reads like two things cannot land in the wrong one.

| `/` | What it reads |
| --- | --- |
| **Finance** | A day's spending from one sentence — *"banh mi 30k, coffee 25k"* |
| **Goals & to-dos** | A paragraph of intentions, split into goals to pursue and tasks to tick off |
| **Looking back** | A conversation about how a week or a month went |

**The goal / to-do split.** It follows one rule: a to-do is finished once and ticked off; a goal is pursued over time and has a sense of progress. Where it could honestly be either, it comes back as a to-do — a to-do is one line to delete, a goal is a record to unpick.

**Checked before you see it.** A goal draft lands in the goal form for you to check. A metric it invented, or a deadline in the wrong century, is dropped before the form ever sees it.

**What leaves the machine.**

- **Goals & to-dos**: only the text you typed — not your existing goals, not your tasks, not a number you have logged.
- **Looking back**: the period's numbers and the observations behind the dashboard's *Worth noticing*, compared with the period before, plus the wins and problems you wrote on the daily log that period and the titles of its lessons. Journal entries, the body of notes and other people's names are not sent.

**Online only.** Adding a transaction works offline through Finance's own form, but quick capture needs a connection: it asks a model to read your sentence, and there is nothing to queue.

## Limits

- Not available without the AI service.
- Eight messages a minute.
- Needs a connection.
- A conversation is not kept once you start over or close the panel.

## Related

- [Finance: transactions](./finance/transactions.md) — **Finance** and **File as spending** propose transactions here; a category's *note for AI* guides the pick
- [Goals](./goals.md) — **Goals & to-dos** fills the goal form; invented metrics and impossible deadlines are dropped
- [Calendar](./calendar.md) — to-dos land as tasks; with a due date they show on that day, without one under **Not on a day yet**
- [Projects](./projects.md) — tasks, which captured to-dos become (with no project)
- [Reviews](./reviews.md) — the written review and its AI narrative; **Looking back** is the conversational counterpart
- [Dashboard](./dashboard.md) — the *Worth noticing* observations **Looking back** is given
- [Daily log](./daily-log.md) — wins and problems **Looking back** reads
- [Learning](./learning.md) — lesson titles are sent to **Looking back**; note bodies are not
- [Keyboard shortcuts](../get-started/keyboard-shortcuts.md) — `⌘J`, and the keyboard button above the launcher
- [Navigation](../get-started/navigation.md) — where the **Capture** launcher sits
- [AI service](../reference/ai-service/overview.md) — the separate service that reads and answers
- [Configuration](../operations/configuration.md) — `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`
- [Data model: reviews and insights](../reference/data-model/reviews-and-insights.md) — `insights` and `ai_reports`
