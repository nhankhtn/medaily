'use server'

import { z } from 'zod'
import { MIN_QUERY_LENGTH } from '@/lib/search'
import type { SearchHit } from '@/server/repositories/search'
import { runSearch } from '@/server/services/knowledge'

export async function searchContent(query: string): Promise<SearchHit[]> {
  const parsed = z.string().trim().min(MIN_QUERY_LENGTH).max(120).safeParse(query)
  if (!parsed.success) return []

  return runSearch(parsed.data)
}
