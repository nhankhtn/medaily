'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import type { FinanceCategory } from '@/lib/db/schema'
import { cn } from '@/lib/utils'
import { CategoryDialog } from './finance-dialogs'

/** First N categories stay visible; the rest sit behind "show more". */
const PREVIEW = 5

/**
 * Category names with an edit affordance. Collapsed by default so a long
 * catalogue does not push budgets and accounts off the overview.
 */
export function CategoryList({ categories }: { categories: FinanceCategory[] }) {
  const t = useTranslations('finance')
  const tc = useTranslations('common')
  const [expanded, setExpanded] = useState(false)
  const needsToggle = categories.length > PREVIEW

  return (
    <div>
      <ul className="divide-border-base divide-y">
        {categories.map((category, index) => (
          <li
            key={category.id}
            className={cn(
              'flex items-start justify-between gap-2 py-2',
              !expanded && index >= PREVIEW && 'hidden',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{category.name}</p>
              {category.note ? (
                <p className="text-text-subtle mt-0.5 line-clamp-2 text-xs">{category.note}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Badge tone={category.kind === 'income' ? 'good' : 'neutral'}>
                {t(`kinds.${category.kind}`)}
              </Badge>
              <CategoryDialog category={category} />
            </div>
          </li>
        ))}
      </ul>

      {needsToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="text-accent mt-2 text-sm font-medium"
        >
          {expanded ? tc('showLess') : tc('showMore')}
        </button>
      ) : null}
    </div>
  )
}
