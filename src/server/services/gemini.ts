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

/** Overridable, because model ids move faster than this file does. */
const DEFAULT_MODEL = 'gemini-3.8-flash'

const TIMEOUT_MS = 20_000

export function geminiEnabled(): boolean {
  return Boolean(env.GEMINI_API_KEY)
}

export function geminiModel(): string {
  return env.GEMINI_MODEL?.trim() || DEFAULT_MODEL
}

/** The subset of JSON Schema the API accepts; kept loose on purpose. */
export type JsonSchema = Record<string, unknown>

type InteractionResponse = {
  status?: string
  steps?: { type?: string; content?: { type?: string; text?: string }[] }[]
  error?: { message?: string }
}

export async function generateJson<T>({
  systemInstruction,
  input,
  schema,
}: {
  systemInstruction: string
  input: string
  schema: JsonSchema
}): Promise<T> {
  const apiKey = env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
      'Api-Revision': API_REVISION,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model: geminiModel(),
      input,
      system_instruction: systemInstruction,
      // Extraction, not authorship: no sampling spread and no long deliberation.
      generation_config: { temperature: 0, thinking_level: 'low' },
      response_format: { type: 'text', mime_type: 'application/json', schema },
      // Nothing is kept on Google's side beyond answering this one request.
      store: false,
    }),
  })

  const body = (await response.json().catch(() => null)) as InteractionResponse | null

  if (!response.ok) {
    throw new Error(`gemini responded ${response.status}: ${body?.error?.message ?? 'no detail'}`)
  }
  if (body?.status && body.status !== 'completed') {
    throw new Error(`gemini did not complete: ${body.status}`)
  }

  const text = outputTextOf(body)
  if (!text) throw new Error('gemini returned no text')

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('gemini returned text that is not JSON')
  }
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
