import { foldText } from '@/lib/text'

/**
 * A key proposed from the name, so nobody has to invent one. It is still
 * editable: the key is what a habit or a goal binds to, and renaming the
 * activity later must not silently move that binding.
 */
export function metricKeyFrom(label: string): string {
  const slug = foldText(label)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (slug.length === 0) return ''
  // Postgres-ish identifiers start with a letter, which the action enforces.
  return (/^[a-z]/.test(slug) ? slug : `m_${slug}`).slice(0, 40)
}
