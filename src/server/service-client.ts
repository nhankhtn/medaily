import { currentRequestId } from '@/lib/log'
import { REQUEST_ID_HEADER } from '@/lib/request-id'

/**
 * Calling one of our own services over HTTP.
 *
 * Not a general HTTP client: the other outbound calls in this app go to third
 * parties, each with its own idea of auth and its own error envelope. This is
 * for a service on the other side of a deploy that we also wrote — a bearer
 * token we hold server-side, JSON both ways, and the same request id on both
 * sides of the wire.
 *
 * Server-side only. The token is a shared secret between two deploys and must
 * never reach a browser, and the request id is read from the incoming request.
 */
const DEFAULT_TIMEOUT_MS = 30_000

/** Carries the status, so a caller can tell "not there" from "it broke". */
export class ServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly service: string,
  ) {
    super(message)
    this.name = 'ServiceError'
  }
}

export type ServiceClient = {
  request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T>
  /** The response itself, for a body that is read as it arrives. */
  open(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<Response>
}

export function serviceClient(config: {
  /** Named in the error, so a log line says which service refused. */
  name: string
  baseUrl: string
  token: string
  timeoutMs?: number
}): ServiceClient {
  const base = config.baseUrl.replace(/\/+$/, '')

  async function open(
    path: string,
    init: RequestInit & { timeoutMs?: number } = {},
  ): Promise<Response> {
    const { timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS, ...rest } = init

    /*
     * The id this request already carries, passed along. A service of ours
     * prefers an id it is given over one it makes up, so both sides log the
     * same string and a failure here and a failure there are one failure.
     */
    const traceId = await currentRequestId()

    const response = await fetch(`${base}${path}`, {
      ...rest,
      headers: {
        ...rest.headers,
        authorization: `Bearer ${config.token}`,
        ...(traceId ? { [REQUEST_ID_HEADER]: traceId } : {}),
      },
      /*
       * The whole exchange, body included — a streamed response is aborted
       * mid-read once this runs out, so give a streaming call a budget for
       * the run and not just for the connection.
       */
      signal: AbortSignal.timeout(timeoutMs),
      cache: 'no-store',
    })

    if (!response.ok) {
      // The body is the service's own wording and is not for a person to
      // read: it goes to the console, and the caller decides what is shown.
      throw new ServiceError(
        `${config.name} responded ${response.status}: ${await response.text()}`,
        response.status,
        config.name,
      )
    }

    return response
  }

  return {
    open,
    async request<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
      const response = await open(path, init)

      // A route that answers with nothing is a valid answer, not a parse error.
      const text = await response.text()
      return (text ? JSON.parse(text) : undefined) as T
    },
  }
}
