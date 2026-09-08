import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page'
import { SearchBox } from '@/features/knowledge/search-box'
import { runSearch } from '@/server/services/knowledge'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const [t, params] = await Promise.all([getTranslations('search'), searchParams])
  const query = (params.q ?? '').trim()
  const hits = query.length >= 2 ? await runSearch(query) : []

  return (
    <div className="space-y-4">
      <PageHeader title={t('title')} />
      <SearchBox initialQuery={query} />

      {query.length < 2 ? (
        <p className="text-sm text-text-subtle">{t('minLength')}</p>
      ) : hits.length === 0 ? (
        <p className="text-sm text-text-subtle">{t('noResults')}</p>
      ) : (
        <>
          <p className="text-sm text-text-muted">{t('results', { count: hits.length })}</p>
          <ul className="space-y-2">
            {hits.map((hit) => (
              <li key={`${hit.type}-${hit.id}`}>
                <Link
                  href={hit.href}
                  className="block rounded-[var(--radius)] border border-border-base bg-surface p-3 hover:border-border-strong"
                >
                  <div className="flex items-center gap-2">
                    <Badge tone="accent">{t(`types.${hit.type}`)}</Badge>
                    <span className="min-w-0 flex-1 truncate font-medium">{hit.title}</span>
                    {hit.date ? (
                      <span className="shrink-0 text-xs tabular-nums text-text-subtle">
                        {hit.date}
                      </span>
                    ) : null}
                  </div>
                  {hit.snippet ? (
                    <p className="mt-1 line-clamp-2 text-sm text-text-subtle">{hit.snippet}</p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
