import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOCALES } from '@/i18n/config'
import { LEGAL_DOCUMENTS, LEGAL_UPDATED_ON, legalDocument } from '@/lib/legal/documents'

/**
 * These documents live outside `messages/*.json`, so the check that keeps the
 * two locales in step has to live here instead. A privacy notice that exists
 * in English and not in Vietnamese is worse than one that exists in neither:
 * it reads as a promise made only to some readers.
 */
describe('the legal documents', () => {
  it('exists in every locale, in every kind', () => {
    for (const locale of LOCALES) {
      for (const kind of LEGAL_DOCUMENTS) {
        const document = legalDocument(locale, kind)
        expect(document.title.trim(), `${locale}/${kind} title`).not.toBe('')
        expect(document.body.trim(), `${locale}/${kind} body`).not.toBe('')
      }
    }
  })

  /** A stub that says nothing is the failure mode worth catching, not a typo. */
  it('says enough to be worth publishing', () => {
    for (const locale of LOCALES) {
      for (const kind of LEGAL_DOCUMENTS) {
        expect(legalDocument(locale, kind).body.length).toBeGreaterThan(800)
      }
    }
  })

  it('tells every reader about erasure and export, which are the rights the app implements', () => {
    const promises: Record<(typeof LOCALES)[number], string[]> = {
      en: ['export', 'delete'],
      vi: ['tải', 'xoá'],
    }
    for (const locale of LOCALES) {
      const body = legalDocument(locale, 'privacy').body.toLowerCase()
      for (const word of promises[locale]) expect(body, `${locale}: ${word}`).toContain(word)
    }
  })

  it('carries a date, so a reader can tell which version they agreed to', () => {
    expect(LEGAL_UPDATED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  /**
   * The notice once said there was no analytics at all, and then analytics was
   * added. A privacy notice that is out of date is not a stale document, it is
   * an untrue statement — so whoever adds the next measurement has to come
   * through here.
   */
  it('names every measurement the app actually loads', () => {
    for (const locale of LOCALES) {
      const body = legalDocument(locale, 'privacy').body
      expect(body, `${locale}`).toContain('Vercel Web Analytics')
      expect(body, `${locale}`).toContain('Speed Insights')
      // The contact form hands a note, and sometimes an address, to a chat.
      expect(body, `${locale}`).toContain('Telegram')
    }
  })
})

/**
 * Who a reader can turn to, written from what is actually configured.
 *
 * The person most likely to need this is the one who cannot sign in or has
 * already deleted their account — so a notice that names a channel nobody set
 * up is a promise that breaks exactly when it matters. Each combination is
 * checked because each is a different sentence.
 */
describe('how to reach anyone', () => {
  const read = async (email: string | undefined, supportForm: boolean) => {
    vi.resetModules()
    if (email === undefined) delete process.env.LEGAL_CONTACT_EMAIL
    else process.env.LEGAL_CONTACT_EMAIL = email
    const { legalDocument: fresh } = await import('@/lib/legal/documents')
    // Only the closing section: "contact form" is also named further up, where
    // the notice discloses what that form collects.
    return fresh('en', 'privacy', { supportForm }).body.split('## Getting in touch')[1] ?? ''
  }

  afterEach(() => {
    delete process.env.LEGAL_CONTACT_EMAIL
  })

  it('offers both when both exist', async () => {
    const body = await read('hello@example.com', true)
    expect(body).toContain('hello@example.com')
    expect(body).toContain('contact form')
  })

  it('offers only the form when no address is set', async () => {
    const body = await read(undefined, true)
    expect(body).toContain('contact form')
    expect(body).not.toContain('@')
  })

  /** The form is the answer for someone whose account is already gone. */
  it('says the form survives the account', async () => {
    expect(await read(undefined, true)).toContain('after an account is gone')
  })

  it('offers only the address when there is no form', async () => {
    const body = await read('hello@example.com', false)
    expect(body).toContain('hello@example.com')
    expect(body).not.toContain('contact form')
  })

  /** Admitting there is no way out beats implying one that does not answer. */
  it('admits it when nothing is configured', async () => {
    const body = await read(undefined, false)
    expect(body).toContain('no channel set up')
    expect(body).not.toContain('{contact}')
  })

  it.each([['hello@'], ['not-an-address'], ['@example.com'], ['   ']])(
    'refuses %j rather than publishing it',
    async (value) => {
      expect(await read(value, false)).toContain('no channel set up')
    },
  )

  /** Self-service is the route that always exists, so it is named first. */
  it('points at the buttons that need nobody', async () => {
    const body = await read(undefined, false)
    expect(body).toContain('Settings')
  })
})
