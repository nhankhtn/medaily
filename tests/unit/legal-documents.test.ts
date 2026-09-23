import { describe, expect, it } from 'vitest'
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
})
