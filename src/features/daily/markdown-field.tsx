'use client'

import { Eye, Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Textarea } from '@/components/ui/input'
import { Markdown } from '@/components/ui/markdown'
import { cn } from '@/lib/utils'
import { Field } from './section'

/**
 * A written field that accepts Markdown, with a preview beside the label.
 *
 * Editing stays the default. These four are answered in a hurry at the end of
 * a day, and most days the answer is one sentence that needs no formatting —
 * the preview is there for the day it is a list of three things.
 */
export function MarkdownField({
  label,
  value,
  placeholder,
  copied,
  className,
  onChange,
}: {
  label: string
  value: string | null
  placeholder?: string
  copied?: boolean
  className?: string
  onChange: (value: string | null) => void
}) {
  const t = useTranslations('common')
  const [preview, setPreview] = useState(false)
  const text = value ?? ''

  return (
    <Field
      label={label}
      copied={copied}
      hint={
        <button
          type="button"
          onClick={() => setPreview((previous) => !previous)}
          // Nothing to preview yet, and a button that shows a dash is noise.
          disabled={text.trim() === ''}
          className="text-accent flex items-center gap-1 text-xs hover:underline disabled:opacity-40 disabled:hover:no-underline"
        >
          {preview ? <Pencil className="size-3" /> : <Eye className="size-3" />}
          {preview ? t('edit') : t('preview')}
        </button>
      }
    >
      {preview ? (
        <div className={cn('border-border-base bg-surface-2 rounded-[var(--radius)] border p-3', className)}>
          <Markdown>{text}</Markdown>
        </div>
      ) : (
        <Textarea
          className={className}
          value={text}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value || null)}
        />
      )}
    </Field>
  )
}
