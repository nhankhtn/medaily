---
title: Career
description: Skills with current and target levels, achievements captured as they happen, and portfolio items linked to projects.
sidebar_position: 10
---

# Career

The career tables hold the skills you are building, the achievements you want to remember at review time, and the work you can show. Shared columns are described in [Data model](./overview.md).

## Tables

| Table | Columns worth knowing |
| --- | --- |
| `skills` | `name`, `category`, `level` (1–5, default 1), `target_level` (1–5), `topic_id` (`SET NULL`), `archived_at` |
| `achievements` | `title`, `achieved_on`, `description`, `impact`, `link`. Captured when it happens, not remembered at review time |
| `portfolio_items` | `title`, `url`, `description`, `tech` (text array), `project_id` (`SET NULL`) |

`skills.topic_id` points at a study topic (see [Learning and knowledge](./learning-and-knowledge.md)); `portfolio_items.project_id` points at a project (see [Work and time](./work-and-time.md)). Deleting either only clears the pointer.

## Related

- [Data model](./overview.md) — conventions shared by every table
- [Career](../../features/career.md) — reads and writes all three tables
- [Learning](../../features/learning.md) — the topics a skill can point at
- [Projects](../../features/projects.md) — the projects a portfolio item can point at
- [Reviews](../../features/reviews.md) — where captured achievements are useful later
- [Learning and knowledge](./learning-and-knowledge.md) — `topics`
- [Work and time](./work-and-time.md) — `projects`
