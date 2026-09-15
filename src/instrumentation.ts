import type { Instrumentation } from 'next'

/**
 * Every server error Next catches, on its way to a Telegram chat.
 *
 * This is the one place that sees all of them — a render, a route handler, a
 * server action, the proxy — so nothing has to be wrapped at the call site.
 * The service is imported lazily: unconfigured, this file stays out of the
 * request path entirely.
 *
 * One header is read, and only that one: the request id the proxy stamped.
 * The rest are never touched — they carry the session cookie.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { environmentName, reportError } = await import('@/server/services/alerts')
  const { REQUEST_ID_HEADER } = await import('@/lib/request-id')

  const stamped = request.headers[REQUEST_ID_HEADER]

  await reportError({
    source: context.routeType,
    environment: environmentName(),
    message: error instanceof Error ? error.message : String(error),
    digest:
      typeof error === 'object' && error !== null && 'digest' in error
        ? String((error as { digest?: unknown }).digest)
        : null,
    requestId: Array.isArray(stamped) ? (stamped[0] ?? null) : (stamped ?? null),
    method: request.method,
    path: request.path,
    stack: error instanceof Error ? (error.stack ?? null) : null,
  })
}
