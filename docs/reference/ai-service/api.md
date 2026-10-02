---
title: AI service API
description: Every HTTP endpoint medaily-ai serves — auth, request and response shapes, the SSE streams, errors, rate limits and request ids.
sidebar_position: 2
---

# AI service API

`medaily-ai` speaks JSON over HTTP. Callers authenticate with one shared bearer
token, and every response carries a request id. Everything except `/health` is
mounted under `/api`.

## Rules

- **One token, every route but health.** Send
  `Authorization: Bearer <SERVICE_TOKEN>`. `GET /health` needs no token.
- **A server with no token refuses everything.** If `SERVICE_TOKEN` is unset,
  every `/api` route answers `503` instead of letting anyone in.
- **The caller says whose data it is.** The assistant routes take a `userId`
  in the body and trust it. The app sets it from the signed-in session, never
  from the browser.
- **There is a ceiling, not a quota.** 60 requests a minute per token on
  `/api` (2 a minute for `/api/models/check`). The limits you meet as a person
  are the app's, and they are tighter.
- **You can always trace a request.** Every response carries `x-request-id`.
  If you send your own, the service uses it.
- **No browser is let in unless named.** CORS answers only the origins in
  `CORS_ORIGINS`; with it empty, none. The app calls from its server, where
  CORS does not apply, so it needs no entry. The token still protects every
  route and must stay server-side.

## Routes

| Route | Token | Used by | Does |
| --- | --- | --- | --- |
| `GET /health` | No | Operators | Says what is configured and whether the database answers |
| `POST /api/chat/live` | Yes | Assistant | One turn of the agent, streamed for a panel |
| `POST /api/chat/stream` | Yes | Debugging | The same run, every node patch with its elapsed time |
| `POST /api/chat` | Yes | Debugging | The same run, as one JSON answer |
| `GET /api/threads/:id` | Yes | Debugging | Reads a thread back out of the checkpointer |
| `DELETE /api/threads/:id` | Yes | Assistant | Ends a conversation |
| `POST /api/capture/finance` | Yes | Quick capture | Reads a note into draft transactions |
| `POST /api/capture/plan` | Yes | Quick capture | Reads a note into draft goals and tasks |
| `POST /api/review/ask` | Yes | Review chat | One turn of a conversation about a period |
| `POST /api/review/translate` | Yes | Review chat | Rewrites one answer in the other language |
| `POST /api/report/narrative` | Yes | Written AI review | Writes the review of a period |
| `GET /api/models` | Yes | Operators | Lists the models the key may use, chain first |
| `GET /api/models/check` | Yes | Operators | Asks each model one question and reports which answer |

The capture, review and report routes read no database and keep no state.
Everything about you arrives in the request, because the app that has that data
also owns the form or page the answer goes into.

## Authentication

`src/http/middleware/auth.ts` (`requireToken`) runs on every `/api` sub-app.

| Situation | Status | Body |
| --- | --- | --- |
| `SERVICE_TOKEN` unset on the server | `503` | `{ "error": "SERVICE_TOKEN is not set on the server" }` |
| Header missing, not `Bearer …`, or the wrong token | `401` | `{ "error": "unauthorized" }` |

The comparison is constant-time (`timingSafeEqual`) and safe for strings of
different lengths. The token is a shared secret between two deploys, not a
session. In the app, the same secret is called `AI_SERVICE_TOKEN`.

## Rate limit

`src/http/middleware/rate-limit.ts` runs on `/api` before the token check.
`/health` is outside it, because it is the endpoint you reach for when
everything else is refusing.

| Bucket | Capacity | Applies to |
| --- | --- | --- |
| `overall` | 60, refilling over a minute | Every `/api` request |
| `check` | 2, refilling over a minute | `/api/models/check`, which also counts against `overall` |

Buckets are keyed on a SHA-256 hash of the `Authorization` header, so a
stranger with a wrong token burns their own bucket, not the app's. Over the
limit, the service answers `429 { "error": "rate_limited", "retryAfterMs": … }`
with a `retry-after` header in seconds.

The limit is deliberately generous: a real request should never meet it. It
exists because the app's own limits are per process, and Vercel runs many
processes; because a loop in a Server Action is not a person; and because the
token might one day be held by something other than the app. The buckets are
token buckets and also per process, so the real allowance is 60 times however
many instances are warm.

The limits you meet as a person are in the app, per person:

| Feature | Limit |
| --- | --- |
| Assistant | 8 messages a minute |
| Review chat | 8 messages a minute |
| Quick capture, finance | 10 notes a minute |
| Quick capture, goals and to-dos | 10 notes a minute |
| Written AI review | 3 a minute |

## Request ids

The first middleware on every request (`src/http/middleware/request-id.ts`)
picks the id as follows:

1. It uses `x-request-id` if the request carries one.
2. Otherwise it uses the last `::` segment of Vercel's `x-vercel-id`.
3. Otherwise it makes one up: 8 hex characters.

Whatever arrives is normalised first: any character outside `[A-Za-z0-9_.-]`
is dropped, and the id is cut to 64 characters. If nothing is left, a fresh id
is made. The id goes on the `x-request-id` response header before the handler
runs, so error responses carry it too. It also appears as `requestId` in `500`
bodies and in the streams' failure events. The app's client
(`src/server/service-client.ts`) forwards its own request id on every call, so
one id covers both halves of a trace. See [Operations](./operations.md).

## Common errors

| Status | Body | When |
| --- | --- | --- |
| `400` | `{ "error": "invalid_input", "detail": [ …zod issues… ] }` | The body fails its schema, or is not JSON |
| `401` / `503` | See [Authentication](#authentication) | |
| `429` | See [Rate limit](#rate-limit) | |
| `500` | `{ "error": "failed", "requestId": "…" }` | A model call or a query failed. The route reports it to Telegram |
| `404` | Hono's plain text | Unknown path |

If an exception escapes a handler, it is logged and reported, and the service
answers `500 { "error": "failed", "requestId" }` with no detail.

## GET /health

Takes no token and has no rate limit.

```json
{
  "ok": true,
  "database": "ok",
  "databaseLatencyMs": 9,
  "gemini": "configured",
  "geminiKeys": 2,
  "models": ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"],
  "token": "configured",
  "alerts": "not_configured",
  "logLevel": "info"
}
```

| Field | Values |
| --- | --- |
| `database` | `not_configured` (no `DATABASE_URL`), `ok` (`select 1` answered), or `unreachable` |
| `databaseLatencyMs` | Present only when `database` is `ok`: the round trip of `select 1` |
| `gemini` | `configured` when at least one key **and** at least one model are set |
| `geminiKeys` | How many distinct keys are loaded. The count, never a key |
| `models` | The model chain in effect, empty when none is set |
| `token` / `alerts` | `configured` or `not_configured` |
| `logLevel` | The level in effect after fallback |

Answers `200` with `ok: true` when the database is `ok` and `gemini` is
configured. Otherwise it answers `503` with `ok: false` and the same fields.

## The assistant routes

All three run the same graph (see [The agent](./agent.md)) and take the same
body:

| Field | Type | Rule |
| --- | --- | --- |
| `message` | string | Trimmed, 1–2000 characters. Required |
| `userId` | string | A UUID. Required: whose data the run may read |
| `threadId` | string | 8–200 characters. Omit it to start a thread; send it back to continue one |
| `timezone` | string | IANA name, used to work out "today". Defaults to `Asia/Ho_Chi_Minh` |

The app sends `{ threadId, userId, message, timezone }`, with the thread id
built as `capture:<userId>:<opening>`, and gives the stream 90 seconds.

### POST /api/chat/live

The run as a waiting person wants it: which step is running, how the message
was read, and then either the answer or the form the message belongs in. It is
a Server-Sent Events stream. Each event is `event: <name>\ndata: <json>\n\n`.

| Event | `data` | When |
| --- | --- | --- |
| `reason` | `{ "reason": "…" }` | As soon as the router decides: one line in your language |
| `file` | `{ "module": "finance" \| "plan" }` | Right after `reason`, when the message is a note to record rather than a question. Nothing follows it |
| `step` | `{ "node": "load" \| "respond" }` | The node that is now running |
| `delta` | `{ "text": "…" }` | A chunk of the answer as Gemini writes it |
| `answer` | `{ "answer": "…" }` | The finished answer |
| `failed` | `{ "requestId": "…" }` | The run failed. The route reports it to Telegram |

There is no opening or closing event: the stream simply ends after `answer`,
`file` or `failed`. A `400` for a bad body arrives before the stream opens.
Once the stream is open, the status is `200` and failures arrive as `failed`.
The rows loaded to write the answer are never sent, because nothing on the
panel reads them.

What the panel does with each event (`src/features/capture/assistant-chat.tsx`):

| Event | The panel |
| --- | --- |
| *(on send)* | Shows *Reading the question…* itself, because routing has begun before anything comes back |
| `reason` | Shows **Read as: …** while the answer is still on its way |
| `step` | Shows *Looking things up…* or *Writing the answer…* |
| `delta` | Fills the answer bubble as it is written |
| `answer` | Replaces the draft with the finished answer |
| `file` | Stops reading, which hangs up on the service, and opens that form with your text |
| `failed` | Shows *Could not answer that. Try again in a moment.* |

If a stream ends without `answer` or `file`, the panel counts it as a failure.
It ignores any `module` other than `finance` or `plan`.

### POST /api/chat/stream

The same run for someone debugging it. Same body and same `400`.

| Event | `data` |
| --- | --- |
| `thread` | `{ "threadId": "…" }`, first, before any work |
| `node` | `{ "node": "route" \| "load" \| "respond", "elapsedMs": 812, "patch": { … } }`, one per finished node, with the state it changed |
| `done` | `{ "threadId": "…" }`: the run finished |
| `error` | `{ "detail": "<error message>", "requestId": "…" }`: the run failed, and was reported |

When an answer takes nine seconds, `elapsedMs` tells you which node spent them.

### POST /api/chat

The same run, answered when it has finished.

```json
{
  "threadId": "…",
  "answer": "Markdown text",
  "decision": {
    "intent": "review",
    "period": "week",
    "filing": "none",
    "reason": "Bạn muốn xem tuần này đi được tới đâu."
  },
  "models": ["route:gemini-3.5-flash-lite", "respond:gemini-3.5-flash-lite"],
  "turns": 4
}
```

- `threadId` is the one you sent, or a new UUID.
- `decision` is what the router decided. When `filing` is not `none`, `answer`
  is empty, because the run stopped at the decision.
- `models` lists which model answered each step, accumulated over the whole
  thread.
- `turns` is how many messages the thread now holds.

A failed run answers `500 { "error": "failed", "detail": "<error message>",
"requestId" }`. This is the only route that returns the error text.

### GET /api/threads/:id

```json
{
  "threadId": "…",
  "createdAt": "2026-09-18T03:12:44.120Z",
  "messages": [
    { "role": "user", "text": "…", "at": "2026-09-18T03:12:40.001Z" },
    { "role": "model", "text": "…", "at": "2026-09-18T03:12:44.100Z" }
  ],
  "decision": { "intent": "…", "period": "…", "filing": "…", "reason": "…" }
}
```

Answers `404 { "error": "not_found" }` when the thread has no checkpoint.

### DELETE /api/threads/:id

Deletes every checkpoint of the thread. Always answers `{ "ok": true }`,
whether or not the thread existed. The app calls it with a 10-second timeout
when the panel closes and on **Start over**.

## POST /api/capture/finance

Reads a note into draft transactions. Nothing is read from the database and
nothing is written.

| Field | Rule |
| --- | --- |
| `text` | Trimmed, 1–2000 characters |
| `today` | `YYYY-MM-DD`, optional. If missing, today in `timezone` |
| `timezone` | Optional, used only when `today` is missing |
| `currency` | 1–8 characters, required |
| `categories` | Up to 200 items of `{ name ≤ 80, kind ≤ 20, note? ≤ 500 }`. Defaults to none |
| `maxItems` | 1–100, optional. The most rows to return. Default 40 |

```json
{
  "transactions": [
    { "occurred_on": "2026-09-27", "amount": 30000, "kind": "expense",
      "category": "Ăn uống", "merchant": "bánh mì", "note": "" }
  ],
  "model": "gemini-3.5-flash-lite"
}
```

What the prompt asks the model to follow:

- One record per payment.
- Amounts in major units, with Vietnamese shorthand understood: `40k`,
  `40 nghìn`, `2tr`, `2 củ`, `1 tỷ`. A record with no price is dropped.
- Relative dates resolved against `today`, never in the future.
- `expense` unless money came in. Transfers are recorded as expenses for you to
  correct.
- The category copied exactly from your list, or `""`.

The app sends `maxItems: 25` and gives the call 45 seconds. It treats every
field as untrusted and turns the rows into drafts with its own rules.

## POST /api/capture/plan

Reads a note into draft goals and tasks.

| Field | Rule |
| --- | --- |
| `text` | Trimmed, 1–2000 characters |
| `today` | `YYYY-MM-DD`, optional. If missing, today in `timezone` |
| `timezone` | Optional |

Answers `{ "items": [ … ], "model": "…" }`. Every item carries every key, for
both kinds:

- **Task fields:** `kind`, `title`, `due_date`, `priority`, `estimate_minutes`.
- **Goal fields:** `kind`, `name`, `description`, `category`, `priority`,
  `start_date`, `target_date`, `progress_mode`, `metric_key`,
  `metric_aggregation`, `metric_period`, `metric_target`, `metric_direction`,
  `milestones`.

Fields that do not apply are `""` or `0`.

What the prompt asks the model to follow:

- Something done once is a task. Something pursued over time is a goal. When
  in doubt, it is a task.
- At most 12 records and 8 milestones per goal.
- When the text asks for a plan to be drawn up ("lên kế hoạch…"), propose one
  goal per subject named, each with two or three first tasks on different
  weeks.
- A goal is measured by a daily metric only when one of the built-in ones fits.
- Text that is not about things to do returns an empty list.

This route sends no response schema, because a row carrying both kinds' fields
is too large for one. If the model answers with a bare array, the route still
accepts it. The app gives the call 45 seconds and checks every row before
showing it.

## POST /api/review/ask

One turn of the review conversation. The app holds the transcript and sends it
back with each turn.

| Field | Rule |
| --- | --- |
| `context` | `{ locale: "en" \| "vi", period: "weekly" \| "monthly", range: { start, end }, …anything else }`. Extra keys are passed to the model as written |
| `history` | Up to 40 items of `{ question ≤ 4000, answer ≤ 20000 }`. Defaults to none |
| `message` | Trimmed, 1–4000 characters |
| `intent` | `open` (write the review of the period), `suggest` (advice was asked for) or `follow_up` |

Answers `{ "text": "…", "model": "…" }`.

The app sends `context` as `{ locale, period, range, reviewing, comparedWith,
observations, writtenByYou: { wins, problems, lessons } }`, at most 12 history
items, and a 90-second timeout. It files each answer in `ai_reports` under
prompt version `review-chat-v1`.

The service sends the context as the first user turn, with a note that
`comparedWith` is for contrast only, then replays the history. The reply is in
`context.locale`, at most 200 words, and gives no advice unless `intent` is
`suggest`. Even then it gives at most three suggestions, each tied to a number
or to a line you wrote.

## POST /api/review/translate

| Field | Rule |
| --- | --- |
| `text` | Trimmed, 1–20000 characters |
| `target` | `en` or `vi` |

Answers `{ "text": "…", "model": "…" }`. Markdown, numbers, dates and the lines
you quoted are kept exactly as they are. No period data is sent, because
translating rewrites the answer on screen rather than producing a new review.

## POST /api/report/narrative

The written review of a period.

| Field | Rule |
| --- | --- |
| `period` | `weekly` or `monthly` |
| `periodStart`, `periodEnd` | `YYYY-MM-DD` |
| `locale` | `en` or `vi` |
| *anything else* | Passed to the model as written |

Answers `{ "text": "…", "model": "…", "promptVersion": "v3" }`. Without a
Gemini key or model, it answers `503 { "error": "disabled" }`, which the app
shows as *AI review is not available.*

The app sends `{ period, periodStart, periodEnd, locale, metrics,
previousMetrics, insights }` with a 180-second timeout, and files the text in
`ai_reports` with the `model` and `promptVersion` that came back.

The review is at most 250 words, in this shape:

1. A paragraph on how the period went.
2. A **What changed** section (*Điều gì thay đổi* in Vietnamese) with up to
   three bullets.
3. A **Worth watching** section (*Đáng chú ý*) with up to three bullets.
4. One closing line naming one thing to try.

It follows the same grounding rules as the assistant.

## GET /api/models

An operator's endpoint. Nothing in the app calls it. It lists what the first
key may use for text, with the configured chain first and in its own order.

```json
{
  "chain": { "models": ["gemini-3.5-flash-lite"], "keys": 2, "source": "GEMINI_MODELS" },
  "models": [
    { "id": "gemini-3.5-flash-lite", "name": "…", "description": "…", "thinking": true,
      "inputTokenLimit": 1048576, "outputTokenLimit": 65536, "configured": 0, "alias": false }
  ]
}
```

- `source` is `GEMINI_MODELS`, `GEMINI_MODEL` or `unset`.
- `configured` is the model's position in the chain, or `null` if it is not in
  the chain.
- `alias` is true for `…-latest` ids. An alias moves under a deployed build,
  which is exactly what a pinned chain is meant to avoid.
- Image, speech, transcription, embedding, video, music and research models
  are filtered out.

If the listing fails, the route answers `502 { "error": "failed", "requestId" }`.

## GET /api/models/check

Asks each model a one-word question on the endpoint the service actually uses.
Checks run in parallel, with 20 seconds each. Without a query it checks the
configured chain. `?models=a,b,c` names up to 8 models instead.

```json
{
  "chain": { "models": ["…"], "keys": 2, "source": "GEMINI_MODELS" },
  "checked": [
    { "id": "gemini-3.5-flash-lite", "ok": true, "status": 200, "elapsedMs": 640, "detail": null }
  ],
  "ok": true
}
```

`ok` is true when at least one model answered. The route answers `400
{ "error": "no_models" }` when there is nothing to check, and `400
{ "error": "too_many", "limit": 8 }` for more than 8 models.

You need both model endpoints because, on a bad afternoon, the listing answers
"all of them" while the check answers "none". Each check costs one real
request per model, which is why it has its own bucket of two a minute.

## The app's own endpoint

`POST /api/assistant` is the app's route handler between the browser and the
service. It is listed here because it shapes every assistant call.

| Step | Rule |
| --- | --- |
| Service unset | `503 { "error": "disabled" }` |
| Body | `{ message: 2–1000 chars, opening: /^[0-9a-z-]{8,64}$/ }`, otherwise `400 { "error": "invalid_input" }` |
| Rate limit | 8 per person per minute, otherwise `429 { "error": "rate_limited" }` |
| Thread id | `capture:<userId>:<opening>`: the person's half comes from the session, the opening's half from the browser |
| Service unreachable | `502 { "error": "failed" }` |
| Success | The service's stream, passed through untouched with `cache-control: no-store, no-transform`, `x-content-type-options: nosniff` and `x-accel-buffering: no` |

The headers matter for three reasons:

- Gzip would buffer the small events until the run ended. That was measured at
  3.8 s to the first event with gzip, against 0.7 s without.
- Chrome holds back the first kilobyte to sniff the content type.
- Nginx buffers a response until it is whole unless told not to.

## Related

- [Overview](./overview.md) — who calls the service and what leaves the machine
- [The agent](./agent.md) — what happens inside the chat routes, and the decision in the response
- [Configuration](./configuration.md) — `SERVICE_TOKEN`, the model chain, and the app's `AI_SERVICE_TOKEN`
- [Operations](./operations.md) — request ids, logs and alerts in detail
- [Assistant](../../features/assistant.md) — the panel that reads `/api/chat/live`
- [Reviews](../../features/reviews.md) — the review chat and the written review
- [Transactions](../../features/finance/transactions.md) — finance capture drafts
- [Goals](../../features/goals.md) — goal and to-do capture drafts
- [Data model: reviews and insights](../data-model/reviews-and-insights.md) — `ai_reports`, where the app files review answers
