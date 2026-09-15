import { describe, expect, it } from 'vitest'
import { createGate } from '@/lib/alerts/gate'
import { redact } from '@/lib/alerts/redact'
import { reportKey, reportText, TELEGRAM_LIMIT, type ErrorReport } from '@/lib/alerts/report'

const report = (over: Partial<ErrorReport> = {}): ErrorReport => ({
  source: 'render',
  environment: 'production',
  message: 'Cannot read properties of null',
  path: '/calendar',
  method: 'GET',
  ...over,
})

describe('redact', () => {
  it('keeps a connection string out of the message', () => {
    const text = redact('Invalid URL: postgres://awish:hunter2@db.neon.tech/medaily')
    expect(text).not.toContain('hunter2')
    expect(text).toContain('postgres://awish:***@db.neon.tech')
  })

  it('blanks a value whose key names it as a secret', () => {
    expect(redact('request failed api_key=abc123def')).toBe('request failed api_key=***')
    expect(redact('header Authorization: Bearer ey.Jh.bGciOi')).not.toContain('bGciOi')
  })

  it('shortens anything long enough to be a key', () => {
    const token = 'A'.repeat(40)
    const out = redact(`token is ${token}`)
    expect(out).not.toContain(token)
    expect(out).toContain('AAAA…[40]')
  })

  it('leaves an ordinary sentence alone', () => {
    const plain = 'Cannot read properties of null (reading id)'
    expect(redact(plain)).toBe(plain)
  })
})

describe('reportText', () => {
  it('names the deploy, the route and the failure', () => {
    const text = reportText(report())
    expect(text).toContain('medaily (production)')
    expect(text).toContain('render · GET /calendar')
    expect(text).toContain('Cannot read properties of null')
  })

  it('carries the digest, which is all a production build gives you', () => {
    expect(reportText(report({ digest: '3921847' }))).toContain('digest 3921847')
  })

  it('quotes the request id, so the message and the console line meet', () => {
    const text = reportText(report({ requestId: '3f9a1c07', digest: '3921847' }))
    expect(text).toContain('req 3f9a1c07')
    expect(text).toContain('digest 3921847')
  })

  it('says nothing about either when there is neither', () => {
    expect(reportText(report())).not.toMatch(/req |digest /)
  })

  it('fits what Telegram accepts, however long the stack', () => {
    const text = reportText(
      report({ message: 'x'.repeat(5000), stack: `Error\n${'  at somewhere\n'.repeat(400)}` }),
    )
    expect(text.length).toBeLessThanOrEqual(TELEGRAM_LIMIT)
  })

  it('redacts on the way out', () => {
    const text = reportText(report({ message: 'Invalid URL: postgres://me:s3cret@host/db' }))
    expect(text).not.toContain('s3cret')
  })
})

describe('the rate gate', () => {
  it('lets the first one through and holds the repeat', () => {
    const gate = createGate({ gapMs: 1000, maxPerHour: 100 })
    expect(gate.allow('a', 0)).toBe(true)
    expect(gate.allow('a', 500)).toBe(false)
    expect(gate.allow('a', 1500)).toBe(true)
  })

  it('does not hold a different failure behind it', () => {
    const gate = createGate({ gapMs: 1000, maxPerHour: 100 })
    expect(gate.allow('a', 0)).toBe(true)
    expect(gate.allow('b', 0)).toBe(true)
  })

  it('stops at the hourly cap and starts again in the next hour', () => {
    const gate = createGate({ gapMs: 0, maxPerHour: 2 })
    expect(gate.allow('a', 0)).toBe(true)
    expect(gate.allow('b', 1)).toBe(true)
    expect(gate.allow('c', 2)).toBe(false)
    expect(gate.allow('c', 3_600_001)).toBe(true)
  })
})

describe('reportKey', () => {
  it('separates the same message on two routes', () => {
    expect(reportKey(report({ path: '/a' }))).not.toBe(reportKey(report({ path: '/b' })))
  })

  it('treats the same failure on the same route as one incident', () => {
    expect(reportKey(report({ stack: 'one' }))).toBe(reportKey(report({ stack: 'other' })))
  })
})
