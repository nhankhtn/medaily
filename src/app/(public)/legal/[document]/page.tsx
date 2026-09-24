import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { Markdown } from '@/components/ui/markdown'
import { isLocale, DEFAULT_LOCALE } from '@/i18n/config'
import {
  LEGAL_DOCUMENTS,
  LEGAL_UPDATED_ON,
  legalDocument,
  type LegalDocument,
} from '@/lib/legal/documents'
import { PATHS } from '@/lib/paths'
import { alertsEnabled } from '@/server/services/alerts'

type Params = { params: Promise<{ document: string }> }

const isDocument = (value: string): value is LegalDocument =>
  (LEGAL_DOCUMENTS as readonly string[]).includes(value)

/** Built at build time — neither document depends on who is reading it. */
export function generateStaticParams() {
  return LEGAL_DOCUMENTS.map((document) => ({ document }))
}

/**
 * The one place in the app that overrides the site-wide `noindex`. Everything
 * else here is somebody's private data; these two are the pages a person is
 * entitled to read before deciding whether to hand any of it over, so they
 * have to be findable without an account.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { document } = await params
  if (!isDocument(document)) return {}

  const locale = await getLocale()
  const { title } = legalDocument(isLocale(locale) ? locale : DEFAULT_LOCALE, document)

  return {
    title,
    robots: { index: true, follow: true },
    alternates: { canonical: PATHS.legal(document) },
  }
}

export default async function LegalPage({ params }: Params) {
  const { document } = await params
  if (!isDocument(document)) notFound()

  const [locale, t] = await Promise.all([getLocale(), getTranslations('legal')])
  const { title, body } = legalDocument(isLocale(locale) ? locale : DEFAULT_LOCALE, document, {
    supportForm: alertsEnabled(),
  })

  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-10 pr-[max(1rem,var(--safe-right))] pb-[max(2.5rem,var(--safe-bottom))] pl-[max(1rem,var(--safe-left))] sm:py-16">
      <h1 className="font-brand text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      <p className="text-text-subtle mt-1 text-xs">{t('updatedOn', { date: LEGAL_UPDATED_ON })}</p>

      {/* `Markdown` is tuned for a note in a card, where everything is one
          size and close together. A document read end to end needs its
          sections to be findable, so the headings get air and weight here
          rather than in the shared component every other screen uses. */}
      <div className="mt-8 [&_h2]:mt-7 [&_h2]:text-base [&_h2]:font-semibold [&_h2:first-child]:mt-0 [&_li]:mt-1 [&_p]:mt-3">
        <Markdown>{body}</Markdown>
      </div>
    </article>
  )
}
