---
title: AI service operations
description: Logging and log levels, request ids across both deploys, Telegram alerts and redaction, failure modes, and what the app shows when medaily-ai is down or unset.
sidebar_position: 6
---

# AI service operations

How to follow one request through `medaily-ai`, how it tells you that something
broke, and what a person using the app sees when it does.

## Rules

- **One id per request, on both sides.** The app sends `x-request-id`; the
  service logs, answers and alerts under the same id.
- **Every failure that reaches a person also reaches the alert chat** — if
  alerts are configured — at most once every five minutes per kind of failure,
  and twenty an hour.
- **Nothing secret leaves in an alert.** Credentials and long tokens are
  redacted first.
- **Unset is not broken.** Without the service configured the app hides the
  features that need it; with it configured but failing, the app says so in a
  short message and keeps your text.
- **Reporting never becomes a second failure.** Sending an alert cannot throw,
  and a refused alert is logged to the console, not re-alerted.

## Health check

`GET /health`, no token. It reports whether the database answers (and how
fast), whether Gemini keys are loaded and how many, the model chain, whether the
token and alerts are configured, and the log level in effect. It answers `200`
when the database answers and both a key and a model are configured, and `503`
otherwise. Fields are listed in [API](./api.md). `databaseLatencyMs` is the number that tells you whether the
function sits near its database or across an ocean from it.

## Logging

Every line is written by `src/lib/log.ts` as `[scope] [req <id>] message`, the
request part present whenever the line was written during a request:

```text
[http]   [req 3f9a1c07] POST /api/chat 500 6332ms
[gemini] [req 3f9a1c07] gemini-3.5-flash-lite on key #1
[chat]   [req 3f9a1c07] run failed GeminiError: …
```

| `LOG_LEVEL` | Adds |
| --- | --- |
| `debug` | One line per model call — which model, which key (by number, `#1`, never the key) |
| `info` | **The default.** One access line per request, and the startup line |
| `warn` | Rotations away from a key or a model; Telegram refusing a message |
| `error` | A request that failed; a database that did not answer |
| `silent` | Nothing to the console. Alerts still go out |

Each level includes everything above it. An unreadable value falls back to
`info` — a typo in a log setting must not take the service down.

The access line is written in a `finally`, so a request that blew up still
leaves a line saying it arrived. For `/api/chat/live` and `/api/chat/stream`,
its duration is the time to the first byte, not the last: the response returns when the stream opens and
the run continues after it. The lines the run itself writes carry the same id
and the real timings.

## Request ids

How the id is chosen and normalised is in [API](./api.md). It is held in an
`AsyncLocalStorage` opened by `src/http/middleware/request-id.ts`, not passed as
a parameter. That is what lets `src/services/gemini.ts` name the request it is
working on without taking an HTTP concern as an argument — the rule the
layering is built on. It survives LangGraph's runner and the SSE callback.

The same id leaves by three doors:

1. The `x-request-id` response header — on every response, including errors.
2. The `requestId` field of a `500` body, and of the `failed` (`/api/chat/live`)
   or `error` (`/api/chat/stream`) stream event.
3. The `req …` line of the Telegram alert.

The app's `src/lib/request-id.ts` and the service's are copies of each other;
when one changes, so does the other. An id that means something different on
each side is worse than no id.

## Alerts

`TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` send failures to a Telegram chat —
the same bot and chat the app uses, so one place shows both services. Unset,
nothing is sent and errors go only to the console. `/health` reports whether
they are configured.

**What is reported.** Two hooks cover the service:

| Source | Catches |
| --- | --- |
| `route` | Anything that escapes a handler and reaches `app.onError`. Answered `500 { "error": "failed", "requestId" }` with no detail |
| `handled` | A failure a route caught itself and turned into a `500`, or into a `failed` or `error` stream event. Scopes: `chat`, `chat/live`, `chat/stream`, `capture/finance`, `capture/plan`, `review/ask`, `review/translate`, `report/narrative`. Hono's hook never sees these, and from outside the request looks answered — exactly the case worth hearing about |

**What the message says** (plain text, no Markdown, at most 4096 characters):

```text
⚠️ medaily-ai (production)
handled · chat/live

<redacted error message>
req 3f9a1c07  ·  thread capture:…

<first six stack lines, redacted>
```

The first line names the service and the environment (`VERCEL_ENV`, else
`NODE_ENV`), so a local run is never mistaken for production and the app's
alerts in the same chat are told apart.

**Rate limit** (`src/lib/alerts/gate.ts`, per process): the same failure at most
once every five minutes, and at most twenty alerts an hour. "The same" means
same source, same scope or path, same message — deliberately not the request id
or the thread. A model chain out of quota fails on every question, and that is
one thing to know, not one per person asking. Being per process, the gate turns
a flood into a trickle on Vercel rather than counting exactly.

**Redaction** (`src/lib/alerts/redact.ts`), on the message and the stack before
anything is sent:

- `Bearer <token>` becomes `Bearer ***`.
- `user:password@host` in any URL becomes `user:***@host`.
- Self-naming pairs — `token=`, `password:`, `api_key=`, `secret`,
  `authorization` and the like — keep the name and lose the value.
- Any run of 28 or more letters, digits, `_` or `-` is cut to its first four
  characters and its length, e.g. `AIza…[39]`.

This is not paranoia: a malformed `DATABASE_URL` throws `Invalid URL` carrying
the whole connection string, password included, in the error message.

Alerts are awaited, with a 4-second timeout, rather than left to finish on
their own: a serverless function can be frozen the moment its response is
written, and a detached promise freezes with it. The wait is paid only when
something has already gone wrong.

## Failure modes

| What happens | Service answers | Logged / alerted |
| --- | --- | --- |
| `SERVICE_TOKEN` unset | `503` on every `/api` route | No |
| Wrong or missing token | `401` | Access line only |
| More than 60 requests a minute on one token (2 for `/api/models/check`) | `429 rate_limited` with `retry-after` | `warn` line |
| Body not valid | `400 invalid_input` | Access line only |
| `DATABASE_URL` unset or unreachable (assistant only) | Run fails: `500`, or `failed` / `error` in a stream | `error` line, alert |
| No Gemini key, or no model configured | `/health` answers `503`; `/api/report/narrative` answers `503 disabled`; every other model call fails with `500` or `failed` | `error` line, alert |
| Gemini `429` on one key | Rotates to the next key on the same model | `warn` line |
| Gemini `503` or `404`, a timeout (20 s for JSON calls, 60 s for answers), or an empty answer | Skips to the next model, which is cooled for every key for 30 s or `retry-after` | `warn` line |
| Every pair cooling or out of quota, or the chain budget (40 s / 120 s) spent | Run fails with the last Gemini error | `error` line, one alert per five minutes |
| Gemini rejects the request (any other status), or returns text that is not JSON | Run fails at once, with no rotation | `error` line, alert |
| An answer breaks off after it started streaming | Run fails, with no retry, because part of the answer has already been sent; the panel gets `failed` | `error` line, alert |
| The function runs past 300 s | Vercel kills it | Vercel's logs |
| Telegram refuses or is unreachable | Nothing changes for the caller | `error` line in the console |

## What the app shows

**Unset** (`AI_SERVICE_URL` or `AI_SERVICE_TOKEN` empty): the features are not
offered at all. No Capture launcher and no `⌘J`, no assistant, no quick
capture, no review chat, no **Write the narrative** button; finance, goals and
to-dos are entered through their own forms. Server Actions answer `disabled`
if they are reached anyway, and `/api/assistant` answers `503`.

**Configured but failing**, by feature:

| Feature | The person sees |
| --- | --- |
| [Assistant](../../features/assistant.md) | *Could not answer that. Try again in a moment.* — also when the stream ends with no answer, or the app cannot reach the service (`502`). The message is put back in the box and the failed turn removed |
| Assistant, past 8 a minute | *Too many questions at once — wait a minute.* The message is put back in the box |
| Quick capture, finance | *Could not read that note* |
| Quick capture, goals and to-dos | *Could not read that text* |
| Review chat (`/` → **Looking back**, see [Reviews](../../features/reviews.md)) | *Could not put that answer together. Try again in a moment.* |
| Written AI review | *Could not generate the review*; *AI review is not available.* when the service answers `503` (no Gemini key or model) |

The service's own error body never reaches a person: the app's client logs it
(`<name> responded <status>: …`) and the feature decides what to show. The app
logs the failure under the same request id, so its console line, the service's
line and the alert can be matched without guessing from timestamps.

Closing the assistant mid-answer cancels the stream and hangs up on the
service. A thread left behind by a tab closed with the panel open is deleted the
next time the panel opens.

## Related

- [Overview](./overview.md) — the architecture these failures happen in
- [API](./api.md) — status codes and the request-id fields
- [The agent](./agent.md) — the Gemini fallback chain behind the quota failures
- [Configuration](./configuration.md) — `LOG_LEVEL`, the Telegram pair, `/health`
- [Assistant](../../features/assistant.md) — the panel's failure messages
- [Reviews](../../features/reviews.md) — the review chat and written review failures
- [Transactions](../../features/finance/transactions.md) — finance capture failures
- [Goals](../../features/goals.md) — goal and to-do capture failures
- [App configuration](../../operations/configuration.md) — the optional services table, including this one
