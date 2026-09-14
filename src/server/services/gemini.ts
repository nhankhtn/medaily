import { env } from '@/lib/env'

/**
 * A thin client over the Gemini Interactions API, for the one thing this app
 * asks of it: turn text into a JSON object matching a schema.
 *
 * Plain `fetch` rather than the SDK — a single POST with no streaming and no
 * conversation state does not earn a dependency.
 */
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions'

/**
 * Pinned deliberately. The May 2026 revision replaced the `outputs` array with
 * `steps` and folded `response_mime_type` into `response_format`; unpinned, the
 * next such change reshapes the response under a deployed build.
 */
const API_REVISION = '2026-05-20'

/**
 * Tried in order, first one that answers wins.
 *
 * The lite tier is the right size for extraction and the one with real
 * headroom: quota on this API is counted per model, so a project that has
 * exhausted its free bucket on one flash model still has the others. Cheapest
 * first, then a step up, so a busy minute costs latency rather than the request.
 *
 * Every id here is a pinned stable release, never a `-latest` alias: an alias
 * moves under a deployed build, which is the failure this chain exists to stop.
 */
export const DEFAULT_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
] as const

/*
 * Per attempt, not for the chain — a slow model must not eat the next one's
 * budget. Extraction runs while someone waits on a form and should give up
 * quickly; a review is a deliberate ask, reasons over a page of numbers, and
 * routinely needs longer than twenty seconds.
 */
const TIMEOUT_MS = { json: 20_000, text: 60_000 } as const

export function geminiEnabled(): boolean {
  return Boolean(env.GEMINI_API_KEY)
}

function parseList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

/**
 * `GEMINI_MODELS` replaces the chain outright. `GEMINI_MODEL` names a first
 * choice and keeps the defaults behind it, so pinning one model does not also
 * throw away the fallbacks.
 *
 * Takes its inputs rather than reading the environment, so the rule can be
 * tested without whatever happens to be in the developer's `.env.local`.
 */
export function resolveModels(models?: string, model?: string): string[] {
  const configured = parseList(models)
  if (configured.length > 0) return configured

  const preferred = model?.trim()
  if (!preferred) return [...DEFAULT_MODELS]
  return [preferred, ...DEFAULT_MODELS.filter((candidate) => candidate !== preferred)]
}

export function geminiModels(): string[] {
  return resolveModels(env.GEMINI_MODELS, env.GEMINI_MODEL)
}

/** The subset of JSON Schema the API accepts; kept loose on purpose. */
export type JsonSchema = Record<string, unknown>

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly model: string,
  ) {
    super(message)
    this.name = 'GeminiError'
  }
}

/**
 * Whether another model is worth trying. Quota (429) and overload (503) are
 * per model, and a 404 means this project cannot reach that id at all — the
 * next one in the chain may well answer. Anything else is about the request
 * itself, so repeating it elsewhere would only waste the user's time.
 */
function worthAnotherModel(error: unknown): boolean {
  return error instanceof GeminiError && [404, 429, 503].includes(error.status ?? 0)
}

type InteractionResponse = {
  status?: string
  steps?: { type?: string; content?: { type?: string; text?: string }[] }[]
  error?: { message?: string }
}

export type GenerateJsonInput = {
  systemInstruction: string
  input: string
  schema: JsonSchema
}

/**
 * One side of a conversation. Prior turns are replayed on every request: the
 * app keeps no interaction open on Google's side, so the transcript is rebuilt
 * from what we stored rather than resumed by id.
 */
export type Turn = { role: 'user' | 'model'; text: string }

export type GenerateTextInput = {
  systemInstruction: string
  turns: Turn[]
}

/** Returns the model that answered too: `ai_reports` records what produced a row. */
export async function generateText(
  request: GenerateTextInput,
): Promise<{ text: string; model: string }> {
  return attemptEachModel(async (model) => ({ text: await requestText(model, request), model }))
}

export async function generateJson<T>(request: GenerateJsonInput): Promise<T> {
  return attemptEachModel((model) => requestJson<T>(model, request))
}

/**
 * Quota is per model, so a model that is out of it says nothing about the next
 * one. Shared by both request shapes.
 */
async function attemptEachModel<T>(attempt: (model: string) => Promise<T>): Promise<T> {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set')

  const models = geminiModels()
  let lastError: unknown = new Error('no gemini model configured')

  for (const [index, model] of models.entries()) {
    try {
      return await attempt(model)
    } catch (error) {
      lastError = error
      const isLast = index === models.length - 1
      if (isLast || !worthAnotherModel(error)) throw error

      console.warn(
        `[gemini] ${model} unavailable (${(error as GeminiError).status}), falling back to ${models[index + 1]}`,
      )
    }
  }

  throw lastError
}

/** The shared round trip: send, check the envelope, hand back the parsed body. */
async function post(
  model: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
): Promise<InteractionResponse> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': env.GEMINI_API_KEY as string,
      'Api-Revision': API_REVISION,
    },
    signal: AbortSignal.timeout(timeoutMs),
    // Nothing is kept on Google's side beyond answering this one request.
    body: JSON.stringify({ model, store: false, ...payload }),
  })

  const body = (await response.json().catch(() => null)) as InteractionResponse | null

  if (!response.ok) {
    throw new GeminiError(
      `gemini responded ${response.status}: ${body?.error?.message ?? 'no detail'}`,
      response.status,
      model,
    )
  }
  if (body?.status && body.status !== 'completed') {
    throw new GeminiError(`gemini did not complete: ${body.status}`, null, model)
  }
  return body ?? {}
}

async function requestJson<T>(
  model: string,
  { systemInstruction, input, schema }: GenerateJsonInput,
): Promise<T> {
  const body = await post(
    model,
    {
      input,
      system_instruction: systemInstruction,
      // Extraction, not authorship: no sampling spread and no long deliberation.
      generation_config: { temperature: 0, thinking_level: 'low' },
      response_format: { type: 'text', mime_type: 'application/json', schema },
    },
    TIMEOUT_MS.json,
  )

  const text = outputTextOf(body)
  if (!text) throw new GeminiError('gemini returned no text', null, model)

  try {
    return JSON.parse(text) as T
  } catch {
    throw new GeminiError('gemini returned text that is not JSON', null, model)
  }
}

/**
 * A conversation replayed in full. There is no open interaction to resume —
 * `store: false` — so every prior turn is sent again as a step. `model_output`
 * is the type the API returns and the only one it accepts back; `model_response`,
 * which the docs show, is rejected.
 */
async function requestText(
  model: string,
  { systemInstruction, turns }: GenerateTextInput,
): Promise<string> {
  const body = await post(
    model,
    {
      input: turns.map((turn) => ({
        type: turn.role === 'user' ? 'user_input' : 'model_output',
        content: [{ type: 'text', text: turn.text }],
      })),
      system_instruction: systemInstruction,
      // Prose over numbers, not extraction: it needs room to weigh them, and a
      // little spread stops every week reading like the same paragraph.
      generation_config: { temperature: 0.3, thinking_level: 'medium' },
    },
    TIMEOUT_MS.text,
  )

  const text = outputTextOf(body)
  if (!text) throw new GeminiError('gemini returned no text', null, model)
  return text
}

/**
 * The text of the last `model_output` step. Earlier steps carry the model's
 * own reasoning and tool traffic, which must not reach the parser.
 */
function outputTextOf(body: InteractionResponse | null): string {
  const outputs = (body?.steps ?? []).filter((step) => step.type === 'model_output')
  const last = outputs.at(-1)
  if (!last) return ''

  return (last.content ?? [])
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('')
    .trim()
}
