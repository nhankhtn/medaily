import { describe, expect, it } from 'vitest'
import { supportText, TELEGRAM_LIMIT, type SupportMessage } from '@/lib/alerts/report'

const note = (over: Partial<SupportMessage> = {}): SupportMessage => ({
  body: 'the finance page stopped loading',
  environment: 'production',
  ...over,
})

describe('a support note on its way to a chat', () => {
  it('says who wrote it and where they were', () => {
    const text = supportText(note({ from: 'mai', replyTo: 'mai@example.com', path: '/finance' }))
    expect(text).toContain('mai')
    expect(text).toContain('mai@example.com')
    expect(text).toContain('/finance')
    expect(text).toContain('the finance page stopped loading')
  })

  /** Answering is the point, so an unanswerable note has to look unanswerable. */
  it('says plainly when there is nobody to answer', () => {
    expect(supportText(note())).toContain('not signed in')
  })

  it('carries the request id, so the console lines can be found', () => {
    expect(supportText(note({ requestId: 'req-42' }))).toContain('req-42')
  })

  /**
   * Somebody describing a problem pastes what was on their screen, and that is
   * sometimes a connection string. The same redaction an exception gets.
   */
  it('strips a credential out of what was pasted', () => {
    const text = supportText(
      note({ body: 'it says Invalid URL for postgres://me:hunter2@db.example.com/app' }),
    )
    expect(text).not.toContain('hunter2')
    expect(text).toContain('***')
  })

  it('strips a token somebody pasted from devtools', () => {
    const text = supportText(note({ body: 'the header was Authorization: Bearer abc.def.ghi' }))
    expect(text).not.toContain('abc.def.ghi')
  })

  /** Telegram refuses a longer body, and a refused note is a lost one. */
  it('fits what Telegram will accept', () => {
    const text = supportText(note({ body: 'x'.repeat(TELEGRAM_LIMIT * 2) }))
    expect(text.length).toBeLessThanOrEqual(TELEGRAM_LIMIT)
  })

  it('names the deploy, so a local run is never mistaken for production', () => {
    expect(supportText(note({ environment: 'preview' }))).toContain('preview')
  })
})
