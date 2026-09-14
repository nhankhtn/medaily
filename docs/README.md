# Documentation

Three documents, each answering a different question.

| Document | Answers |
| --- | --- |
| [features.md](features.md) | What the app does and how to use it |
| [database.md](database.md) | What is stored, column by column, and how the tables relate |
| [CHANGELOG.md](CHANGELOG.md) | What changed in these documents, and when |

## Keeping them honest

Documentation that drifts is worse than none: it is read with the same trust
and answers with yesterday's facts.

**When a change touches `drizzle/`, update [database.md](database.md) in the
same commit.** A migration that ships without the document leaves a column
nobody can explain six months later.

**When a change adds or removes something a person can see or do, update
[features.md](features.md).** The test is whether the "how to use it" steps
still work if followed literally.

Either way, add a dated line to [CHANGELOG.md](CHANGELOG.md) saying what moved.

To read the live schema rather than trusting the document:

```bash
psql "$DATABASE_URL" -c '\d+ daily_logs'
```
