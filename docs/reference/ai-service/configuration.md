---
title: AI service configuration
description: Every medaily-ai environment variable, the checkpointer setup and benchmark scripts, running the service locally, and deploying it to Vercel.
sidebar_position: 5
---

# AI service configuration

`medaily-ai` reads its settings once, at import, from the environment
(`src/config/env.ts`). Nothing missing is fatal at boot: `/health` reports what
is absent, which is more useful during setup than a process that refuses to
start.

## Rules

- **Two sides, two names for the same secret.** The service's `SERVICE_TOKEN`
  is the app's `AI_SERVICE_TOKEN`. They must be equal.
- **The service needs four things to answer:** `DATABASE_URL`, at least one
  Gemini key, at least one model, and `SERVICE_TOKEN`.
- **No model is built in.** The chain is exactly what `GEMINI_MODELS` (or
  `GEMINI_MODEL`) names. With neither set, nothing that needs a model answers.
- **A bad log level never stops the service.** An unreadable `LOG_LEVEL` falls
  back to `info`.
- **Alerts are set on the deploy, not locally**, or every typo on your machine
  buzzes your phone.
- **`db:setup` writes to whatever `DATABASE_URL` names** — production as easily
  as local. It prints the host first.

## The app side

Set in `medaily-frontend` (see [App configuration](../../operations/configuration.md)):

| Variable | Meaning |
| --- | --- |
| `AI_SERVICE_URL` | Base URL of the service, e.g. `https://ai.example.com`. A trailing `/` is stripped |
| `AI_SERVICE_TOKEN` | The shared secret, sent as `Authorization: Bearer …`. Server-side only |

Both must be set, or the app treats the service as absent and offers none of
its features. The Gemini keys and model chain are not set in the app any more;
they live in the service.

## Environment variables

Every variable `src/config/env.ts` reads, plus the two read elsewhere.

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes, to answer | `""` | The app's Neon database. The app's tables are read here; the checkpointer writes its own tables here in schema `agent`. Unset: `/health` says `not_configured` and every run fails |
| `GEMINI_API_KEY` | One key, here or below | — | A Gemini API key |
| `GEMINI_API_KEYS` | One key, here or above | — | More keys, comma-separated. **Added to** `GEMINI_API_KEY`, not instead of it, so a deploy with one key keeps it when it gains a list. Duplicates are dropped |
| `GEMINI_MODELS` | One of these two | — | The chain: model ids, comma-separated, tried in order. There is no built-in list behind it. Example from `.env.example`: `gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.5-flash` |
| `GEMINI_MODEL` | One of these two | — | A chain of one. Used only when `GEMINI_MODELS` is empty |
| `SERVICE_TOKEN` | Yes | — | The shared secret callers send as `Authorization: Bearer <token>`. If it is unset, every `/api` route answers `503` |
| `CORS_ORIGINS` | No | — (none) | Browser origins allowed to call the API, comma separated, e.g. `https://medaily.app,http://localhost:3000`. Leave empty: the app calls from its server, where CORS does not apply |
| `TELEGRAM_BOT_TOKEN` | No | — | Bot that receives failure alerts — the same bot the app uses |
| `TELEGRAM_CHAT_ID` | No | — | Chat the alerts go to — the same chat the app reports into. Alerts are on only when both are set |
| `LOG_LEVEL` | No | `info` | `debug`, `info`, `warn`, `error` or `silent`. See [Operations](./operations.md) |
| `PORT` | No | `3001` | Local server port. Not in `.env.example`; unused on Vercel |
| `NODE_ENV` | No | `development` | Named in alerts when `VERCEL_ENV` is absent |
| `VERCEL_ENV` | Set by Vercel | — | Named on the first line of every alert (`production`, `preview`) |
| `NODEJS_HELPERS` | Set in `vercel.json` | `0` | Build-time. See [Deploy to Vercel](#deploy-to-vercel) |

Keys add up because silently dropping a key that still has quota, just
because a list was set, costs capacity. Models are never filled in for you: a
model id names a tier, a price and a quota bucket, and a model shipped in a
release months ago would be a choice nobody made. When the configured model
starts refusing, a person should decide what runs instead. More than one model
is still worth having, because quota is counted per model. To choose models,
call `GET /api/models` (what the key may use) and `GET /api/models/check`
(which models answer right now). See [API](./api.md).

With no key or no model, `/health` reports `gemini: not_configured` and answers
`503`. `/api/report/narrative` then answers `503 disabled`. Every other route
that needs a model fails the request with a `500`.

Locally, `src/config/load-env.ts` loads `.env.local` and then `.env` (the first
one wins for a variable both define). On Vercel neither file exists and the
platform's environment is used.

## Run it locally

1. Install: `corepack pnpm install` (Node 22 or later).
2. Copy the example: `cp .env.example .env.local`. Then fill in
   `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODELS` (or `GEMINI_MODEL`) and
   `SERVICE_TOKEN`.
3. Create the checkpointer's tables: `corepack pnpm db:setup`.
4. Start it: `corepack pnpm dev` — `tsx watch` on `src/http/server.ts`, at
   `http://localhost:3001`.
5. Check it: `curl localhost:3001/health`.
6. Ask it something — `userId` must be a real user's UUID:

   ```bash
   TOKEN=$(grep '^SERVICE_TOKEN=' .env.local | cut -d= -f2)

   curl -sX POST localhost:3001/api/chat \
     -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
     -d '{"message":"tuần này tôi thế nào","userId":"<uuid>"}'

   # Continue the thread with the threadId it returned
   curl -sX POST localhost:3001/api/chat \
     -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
     -d '{"message":"còn tháng trước?","userId":"<uuid>","threadId":"<from above>"}'

   curl -s -H "authorization: Bearer $TOKEN" localhost:3001/api/threads/<id>

   # Which configured models answer right now
   curl -s -H "authorization: Bearer $TOKEN" localhost:3001/api/models/check
   ```

To point the app at your local service, set
`AI_SERVICE_URL=http://localhost:3001` in the app's `.env.local`, and set
`AI_SERVICE_TOKEN` there to the same value as the service's `SERVICE_TOKEN`.
The app adds `/api/...` to the URL itself.

## Scripts

| Command | Does |
| --- | --- |
| `pnpm dev` | Local server with reload |
| `pnpm start` | Local server, no reload |
| `pnpm build` | `tsc --noEmit`: a typecheck that emits nothing (see below) |
| `pnpm test` | Vitest: the Gemini chain, the guide, period phrases, session gaps, both rate limits, the step logic. No database and no model are reached |
| `pnpm db:setup` | `scripts/setup-checkpointer.ts` — creates the `agent` schema and the checkpointer's tables |
| `pnpm bench` | `scripts/bench-checkpoint.ts` — measures what a checkpoint costs |
| `pnpm check` | `tsc --noEmit`, then ESLint, then `prettier --check` |
| `pnpm lint` / `pnpm lint:fix` | Type-aware ESLint; `:fix` applies what it can |
| `pnpm format` / `pnpm format:check` | Prettier in place / check only |

### db:setup

Runs LangGraph's `PostgresSaver.setup()` against `DATABASE_URL`, in schema
`agent`. Prints the host before it starts and `Done. Tables live in the "agent"
schema.` when it has finished. Idempotent: run it once before the first request,
and again after upgrading `@langchain/langgraph-checkpoint-postgres`.

### bench

The one number that decides whether the graph belongs on Vercel: what a
checkpoint write costs against Neon, per node.

1. Prints the database host and the round trip of `select 1`.
2. Runs `db:setup`, then one warm-up run each against memory and Postgres.
3. Runs the same trivial three-node graph 10 times with LangGraph's in-memory
   saver and 10 times with the Postgres one. No model is called: an LLM's
   variance would bury the number.
4. Prints median, minimum and maximum for each, then the overhead per run and
   per node. Over 150 ms per node it says the function is too far from the
   database; otherwise *Workable*.

Run it from a deployed function, not a laptop: from Vietnam the number is
dominated by the ~250 ms round trip to `us-east-2` and says nothing about
production. It leaves its `bench-…` and `warmup-pg` threads in the `agent`
schema.

## Style and lint

Prettier owns formatting — no semicolons, single quotes, 100 columns. ESLint
owns correctness only; `eslint-config-prettier` turns off every rule the two
could disagree on. The lint is type-aware (`recommendedTypeChecked`), slower
than a plain lint on purpose: most of what goes wrong in this service is a
promise nobody waited for — a checkpoint write, a Telegram report — and a
linter without types cannot see one.

In VS Code, `.vscode/settings.json` formats on save, applies ESLint's fixes,
and sets `importModuleSpecifierEnding: "js"` so auto-import writes the `.js`
Node's ESM loader needs.

## Deploy to Vercel

1. Link the repo to a Vercel project and set the variables above on it: at
   least `DATABASE_URL`, a Gemini key, `GEMINI_MODELS` and `SERVICE_TOKEN`, plus
   the Telegram pair if you want alerts.
2. Run `pnpm db:setup` once against the production `DATABASE_URL`.
3. Deploy. `api/index.ts` is the whole function.
4. Check `GET /health` and `GET /api/models/check` on the deployed URL. Then
   set the app's `AI_SERVICE_URL` and `AI_SERVICE_TOKEN`.

What `vercel.json` does, and why:

| Setting | Why |
| --- | --- |
| `regions: ["iad1"]` | Next to Neon in `us-east-2`. The graph writes a checkpoint after every node, so the function talks to the database far more than to the browser. Moving it closer to Vietnam would add a round trip to every node |
| `functions["api/index.ts"].maxDuration: 300` | The Hobby plan's ceiling, about ten times what a run needs |
| `rewrites: /(.*) → /api` | Every path reaches the one function, and Hono routes on the original URL |
| `buildCommand: tsc --noEmit` | esbuild — which both `tsx` and Vercel use — strips types without checking them. Without this a type error deploys quietly and fails at runtime |
| `outputDirectory: public` | With a `build` script Vercel insists on an output directory and fails with *No Output Directory named "public" found*. `public/` is committed empty for this. Delete it and the build breaks; drop the `build` script instead if the typecheck is ever unwanted |
| `build.env.NODEJS_HELPERS: "0"` | Read at build time, so it belongs here, not in the dashboard. Left on, Vercel wraps the request with its own body parser, which consumes the stream; the adapter then reads an empty body and `POST /api/chat` fails on a message that was sent correctly |

There is no compile step: `tsx` runs TypeScript directly in development, and
Vercel builds the function itself.

> **Important:** The adapter must be `@hono/node-server/vercel`, not
> `hono/vercel`. Vercel calls a default export as `(req, res)`. `hono/vercel`'s
> handler takes a web `Request` and returns a `Response`, so under Node it never
> writes to `res`, and every request hangs until `maxDuration` — 300 seconds of
> silence, no error in the logs. `api/index.ts` also declares
> `runtime: "nodejs"`: the checkpointer speaks the Postgres wire protocol, which
> the Edge runtime cannot.

> **Note:** `pg` warns that `sslmode=require` will one day mean `verify-full`.
> Neon presents a publicly trusted certificate, so this is expected to keep
> working; if it ever stops, `uselibpqcompat=true&sslmode=require` is the
> escape hatch.

## Related

- [Overview](./overview.md) — deployment at a glance
- [API](./api.md) — what `SERVICE_TOKEN` protects
- [The agent](./agent.md) — how the model chain and keys are used
- [Data access](./data-access.md) — what `DATABASE_URL` is used for
- [Operations](./operations.md) — `LOG_LEVEL`, alerts and `/health`
- [App configuration](../../operations/configuration.md) — the app's `AI_SERVICE_URL` and `AI_SERVICE_TOKEN`
- [Assistant](../../features/assistant.md) — what turns on when both are set
- [Reviews](../../features/reviews.md) — the AI review and review chat, also gated on them
