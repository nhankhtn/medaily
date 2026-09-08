'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Markdown rendering with `[[wiki links]]` turned into visible link chips
 * before parsing, so the syntax reads as a link rather than as brackets.
 */
export function Markdown({ children }: { children: string }) {
  const withLinks = children.replace(/\[\[([^\]]{1,200})\]\]/g, (_, title: string) => `**[[${title}]]**`)

  return (
    <div className="prose-sm max-w-none space-y-2 text-sm leading-relaxed [&_a]:text-accent [&_a]:underline [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-surface-2 [&_pre]:p-3 [&_table]:w-full">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{withLinks}</ReactMarkdown>
    </div>
  )
}
