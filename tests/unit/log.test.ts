import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ErrorReport } from '@/lib/alerts/report'

/**
 * What reaches a phone, and what must never.
 *
 * The recursion guard is the one worth pinning: the alert service logs through
 * this module when Telegram refuses a message, so a scope it does not exclude
 * would try to tell Telegram that Telegram is unreachable, and keep trying.
 *
 * Hoisted, because `vi.mock` factories run before the module body and would
 * otherwise close over bindings that do not exist yet.
 */
const { reportError, scheduled } = vi.hoisted(() => ({
  reportError: vi.fn<(report: ErrorReport) => Promise<'sent'>>(),
  scheduled: [] as Promise<unknown>[],
}))

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-request-id': 'req-1' }),
}))

/*
 * `after` hands the send to the platform to run once the response is out, so
 * `log.error` resolves before the report does — that is the whole point of it,
 * and a caller waiting on a failure must not also wait on Telegram. The mock
 * keeps the scheduled work so a test can await it deliberately.
 */
vi.mock('next/server', () => ({
  after: (fn: () => unknown) => {
    scheduled.push(Promise.resolve().then(fn))
  },
}))

/** Lets the work `after` was handed finish. */
const settle = () => Promise.all(scheduled.splice(0))

vi.mock('@/server/services/alerts', () => ({
  reportError,
  environmentName: () => 'test',
}))

const { log } = await import('@/lib/log')

beforeEach(() => {
  reportError.mockClear()
  scheduled.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('log.error', () => {
  it('reports a handled failure, naming the scope it came from', async () => {
    await log.error('reviews', 'could not answer', new Error('gemini returned no text'))
    await settle()

    expect(reportError).toHaveBeenCalledTimes(1)
    expect(reportError.mock.calls[0]![0]).toMatchObject({
      source: 'handled',
      scope: 'reviews',
      message: 'could not answer: gemini returned no text',
      requestId: 'req-1',
    })
  })

  it('never reports the alert service itself, or the loop would not end', async () => {
    await log.error('alerts', 'could not reach telegram', new Error('fetch failed'))
    await settle()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('leaves the rest of the details behind: they are the user`s own writing', async () => {
    await log.error('capture', 'could not read that note', new Error('bad json'), {
      note: 'cà phê với Lan 25k',
    })
    await settle()

    const sent = JSON.stringify(reportError.mock.calls[0]![0])
    expect(sent).not.toContain('cà phê')
    expect(sent).toContain('bad json')
  })

  it('carries the stack, which is where the line number is', async () => {
    const cause = new Error('boom')
    await log.error('finance', 'could not parse the note', cause)
    await settle()
    expect(reportError.mock.calls[0]![0]).toMatchObject({ stack: cause.stack })
  })

  it('still reports a failure logged without an Error object', async () => {
    await log.error('settings', 'falling back to defaults')
    await settle()
    expect(reportError.mock.calls[0]![0]).toMatchObject({
      message: 'falling back to defaults',
      stack: null,
    })
  })

  it('writes the console line whether or not the report gets through', async () => {
    reportError.mockRejectedValueOnce(new Error('telegram is down'))
    await expect(
      log.error('reviews', 'could not answer', new Error('gemini returned no text')),
    ).resolves.toBeUndefined()
    await settle()
    expect(console.error).toHaveBeenCalled()
  })
})

describe('log.warn', () => {
  it('stays in the console: a model falling back is not phone-worthy', async () => {
    await log.warn('gemini', 'model-a said nothing, falling back to model-b')
    await settle()
    expect(console.warn).toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
  })
})
