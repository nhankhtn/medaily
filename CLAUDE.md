@AGENTS.md

# Deploying

A push to `main` deploys. Code reaches production in about a minute; a
migration never runs itself. So a schema change that is pushed before it is
migrated takes the affected pages down until someone notices.

**Before every push, check whether the commits touch `drizzle/`. If they do,
run the migration on production first:**

```bash
DATABASE_URL="<production connection string>" pnpm db:migrate
```

`pnpm db:migrate` prints the host and database before it touches anything, and
says how many migrations it applied — read that line and confirm it is
production, not the local database. If the production URL is not to hand, ask
for it and wait; do not push the migration and leave it unapplied.

Order matters in one direction only: the migration goes first. Every migration
in this repo must therefore be safe against the version of the code already
running — add columns and tables, and leave the drops for a later pass.
