'use client'

import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { Field } from './section'

/**
 * A written field that edits blocks rather than Markdown source: a `# ` line
 * becomes a heading, `**bold**` closes into bold text, `/` picks a block.
 *
 * There is no preview beside it, because there is nothing left to preview —
 * what is on screen is already the finished thing. What is stored is still
 * Markdown.
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
  return (
    <Field label={label} copied={copied} off={off}>
      <MarkdownEditor
        label={label}
        className={className}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(next) => onChange(next || null)}
      />
    </Field>
  )
}
