'use client'

import { ChevronDown, Pencil, StickyNote } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import type { PersonView } from '@/server/services/people'
import { PersonDialog } from './people-ui'
import { cn } from '@/lib/utils'

/**
 * Notes were being saved and never shown, which made the field feel pointless.
 * They now render as Markdown, collapsed by default so a long note does not
 * push the rest of the list off the screen.
 */
export function PersonNotes({ person }: { person: PersonView }) {
  const t = useTranslations('people')
  const [open, setOpen] = useState(false)

  const hasNotes = Boolean(person.notes?.trim())

  return (
    <div className="mt-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="flex items-center gap-1.5 text-xs text-text-subtle hover:text-text"
        >
          <StickyNote className="size-3.5" />
          {hasNotes ? (open ? t('hideNotes') : t('showNotes')) : t('noNotes')}
          {hasNotes ? (
            <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
          ) : null}
        </button>

        <PersonDialog
          person={person}
          trigger={
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs">
              <Pencil className="size-3" />
            </Button>
          }
        />
      </div>

      {open && hasNotes ? (
        <div className="mt-2 rounded-[var(--radius)] border border-border-base bg-surface-2 p-3">
          <p className="mb-1.5 text-xs font-medium text-text-muted">
            {t('notesAbout', { name: person.name })}
          </p>
          <Markdown>{person.notes ?? ''}</Markdown>
        </div>
      ) : null}
    </div>
  )
}
