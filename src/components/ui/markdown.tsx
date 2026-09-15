'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { withResolvedWikiLinks, type NoteLinkTargets } from '@/lib/knowledge/links'
import { PATHS } from '@/lib/paths'

/**
 * Markdown rendering.
 *
 * Given `targets`, a `[[wiki link]]` to a note that exists becomes a real link
 * to it; one to a note not written yet stays as bold brackets, because there
 * is nowhere to send the reader. Without `targets` — the journal, a review —
 * every wiki link stays bold, which is what it did before any of them linked.
 */
export function Markdown({
  children,
  targets,
}: {
  children: string
  targets?: NoteLinkTargets
}) {
  const withLinks = withResolvedWikiLinks(children, targets ?? {}, PATHS.note)

  return (
    <div className="prose-sm [&_a]:text-accent [&_code]:bg-surface-2 [&_pre]:bg-surface-2 [&_blockquote]:border-border-strong [&_blockquote]:text-text-muted max-w-none space-y-2 text-sm leading-relaxed [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:px-1 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_ol]:ml-4 [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:p-3 [&_table]:w-full [&_ul]:ml-4 [&_ul]:list-disc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => {
            const external = Boolean(href && /^https?:\/\//.test(href))
            return (
              <a
                href={href}
                {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                {...props}
              >
                {children}
              </a>
            )
          },
        }}
      >
        {withLinks}
      </ReactMarkdown>
    </div>
  )
}
