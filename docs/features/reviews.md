---
title: Reviews
description: Weekly, monthly and yearly reviews — the period's numbers computed for you, five questions to answer, and an optional AI narrative.
sidebar_position: 16
---

# Reviews

A review looks back over a week, a month or a year. The period's numbers are computed for you from the daily log; you answer five questions — what worked, what did not, what to change, the top priority, and a free reflection. The page brings back what you already wrote that period so you do not have to remember it, and holds up the priority you set last time.

| | |
| --- | --- |
| **Where** | `/reviews` · sidebar → Insight · phone → **More** |
| **Works offline** | No |
| **Needs** | Nothing extra. The AI narrative needs the AI service (`AI_SERVICE_URL`) — see [Configuration](../operations/configuration.md) and [AI service](../reference/ai-service/overview.md) |

## Rules

- There is one review per week, per month and per year.
- A draft recomputes its numbers every time you open it.
- **Finalize** freezes the numbers, so the review still shows what it showed then.
- A finalized review can be reopened, or have its numbers recomputed on purpose.
- The AI narrative is available for a week or a month, not a year.
- The AI narrative is sent only aggregate numbers and rule-generated observations — no notes, no journal entries, no names — and is always labelled as AI.
- A week follows **Settings → Week starts on**.

## Write a review

1. Open **Reviews** and pick **weekly**, **monthly** or **yearly**.
2. Move to the period you want with the arrows.
3. Read the numbers: days logged, the period score, average energy and sleep, study, deep work, exercise days, reading, entertainment, habit completion, and the best and hardest day.
4. Above the questions, read **Last period you wrote: "…" Did it happen?** — the priority you set last time.
5. Look at **From your daily wins** and **From your daily problems**, which gather what you wrote on the daily log that period. Press **Use these** to pull them into your answer.
6. Look at **Learned this period**, the period's lessons grouped by tag.
7. Answer the five questions in the [editor](./editor.md): what worked, what did not, what to change, the top priority, and a free reflection.
8. Press **Save draft** to keep the text.

## Finalize a review

1. When the period is over and the review is written, press **Finalize**.
2. The numbers are frozen as they are now.

To change it later, press **Reopen**. To bring its numbers up to date on purpose — for example after logging a missed day — press **Recompute numbers**.

## Generate an AI narrative

With the AI service configured:

1. Open a weekly or monthly review.
2. Press **Write the narrative**.
3. Read it — it is always labelled as AI-generated.

## How it works

**Numbers from the log, words from you.** The period's figures are derived from the daily log every time a draft opens, so a day logged late still counts. Finalizing takes a snapshot, so a review read a year later shows what it showed then rather than what the data has since become.

**Seeded from the daily log.** The daily log's win and problem fields are gathered for the period under **From your daily wins** and **From your daily problems**; **Use these** pulls them into the text rather than leaving you to remember them. The priority you wrote last period is held up above the questions, so a review starts by checking it.

**Lessons by tag.** Notes typed as lessons carry the day they were learned and a place tag, so **Learned this period** can group them by tag — a lesson under two tags appears under both.

**What the AI is sent.** For the narrative, only aggregate numbers and rule-generated observations are sent — no notes, no journal entries, no names — and the result is always labelled. The model and prompt version are stored with each report so an old one can be read in context. Without the AI service there is no narrative; everything else on the page works.

**The period score** is built from the same day scores as the dashboard, using the weights and targets in **Settings → Score weights**.

## Limits

- No AI narrative for a yearly review.
- No AI narrative at all without the AI service.

## Related

- [Daily log](./daily-log.md) — the numbers, and the wins and problems the review gathers, come from it
- [Learning](./learning.md) — lessons feed **Learned this period**
- [Editor](./editor.md) — the editor the five answers are written in
- [Dashboard](./dashboard.md) — the same score; **Getting started** asks for a weekly review; **Worth noticing** observations are what the AI narrative is given
- [Habits](./habits.md) — habit completion for the period
- [Health](./health.md) — workouts become exercise days
- [Assistant](./assistant.md) — **Looking back** is a conversation about a week or a month, from the same numbers
- [Analytics](./analytics.md) — trends and comparisons over the same data
- [Settings](./settings.md) — **Week starts on** sets the weekly period; **Score weights** sets the period score
- [AI service](../reference/ai-service/overview.md) — the separate service that writes the narrative
- [Data model: reviews and insights](../reference/data-model/reviews-and-insights.md) — `weekly_reviews`, `monthly_reviews`, `yearly_reviews`, `ai_reports`
- [Data model: daily log](../reference/data-model/daily-log.md) — the rows the numbers are computed from
