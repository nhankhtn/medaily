'use client'

import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Input } from '@/components/ui/input'

export function SearchBox({ initialQuery }: { initialQuery: string }) {
  const t = useTranslations('search')
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        router.push(`/search?q=${encodeURIComponent(query)}`)
      }}
      className="relative"
    >
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle" />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('placeholder')}
        aria-label={t('placeholder')}
        className="pl-9"
        autoFocus
      />
    </form>
  )
}
