'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Markdown } from '@/components/ui/markdown'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { hasInlineMarkdown } from '@/lib/markdown'
import { Field } from './section'

/**
 * A written field that accepts Markdown and shows it as it is written: a line
 * starting `# ` is a heading in the box, a `- ` line is a bullet.
 *
 * The preview below is only for the marks the box cannot show in place —
 * `**bold**`, a link, a table. Repeating a heading underneath the heading you
 * can already see would be the same words twice.
 */
export function MarkdownField({
  label,
  value,
  placeholder,
  copied,
  off,
  className,
  onChange,
}: {
  label: string
  value: string | null
  placeholder?: string
  copied?: boolean
  /** Turned off in settings, and empty on this day. */
  off?: boolean
  className?: string
  onChange: (value: string | null) => void
}) {
  const t = useTranslations('common')
  const [hidden, setHidden] = useState(false)
  const text = value ?? ''
  const inline = hasInlineMarkdown(text)

  return (
    <Field
      label={label}
      copied={copied}
      off={off}
      hint={
        inline ? (
          <button
            type="button"
            onClick={() => setHidden((previous) => !previous)}
            className="text-accent flex items-center gap-1 text-xs hover:underline"
          >
            {hidden ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
            {t('preview')}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-1.5">
        <MarkdownEditor
          label={label}
          className={className}
          value={text}
          placeholder={placeholder}
          onChange={(next) => onChange(next || null)}
        />

        {inline && !hidden ? (
          <div className="glass rounded-[var(--radius)] p-3">
            <Markdown>{text}</Markdown>
          </div>
        ) : null}
      </div>
    </Field>
  )
}
