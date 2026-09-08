'use client'

import { Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Markdown } from '@/components/ui/markdown'
import { Select } from '@/components/ui/select'
import { Field } from '@/features/projects/project-dialog'
import { removeNote, saveNote } from '@/server/actions/knowledge'
import type { NoteView } from '@/server/services/knowledge'

const TYPES = ['note', 'concept', 'bookmark'] as const

export function NoteEditor({ note, trigger }: { note?: NoteView; trigger?: React.ReactNode }) {
  const t = useTranslations('knowledge')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState(note?.bodyMd ?? '')
  const [preview, setPreview] = useState(false)
  const [pending, startTransition] = useTransition()

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveNote({
        id: note?.id,
        title: String(formData.get('title') ?? ''),
        bodyMd: body,
        type: formData.get('type'),
        url: String(formData.get('url') ?? ''),
        tags: String(formData.get('tags') ?? '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      })

      if (!result.ok) {
        toast.error(tc('error'))
        return
      }
      toast.success(t('saved'))
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" />
            {t('newNote')}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent title={note ? tc('edit') : t('newNote')} description={t('wikiHint')}>
        <form action={submit} className="space-y-3">
          <Field label={t('noteTitle')}>
            <Input name="title" defaultValue={note?.title} required autoFocus maxLength={300} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('type')}>
              <Select name="type" defaultValue={note?.type ?? 'note'}>
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`types.${type}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('url')}>
              <Input name="url" type="url" defaultValue={note?.url ?? ''} maxLength={500} />
            </Field>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t('body')}</span>
              <button
                type="button"
                onClick={() => setPreview((prev) => !prev)}
                className="flex items-center gap-1 text-xs text-accent hover:underline"
              >
                {preview ? <Pencil className="size-3" /> : <Eye className="size-3" />}
                {preview ? tc('edit') : tc('showMore')}
              </button>
            </div>

            {preview ? (
              <div className="min-h-40 rounded-[var(--radius)] border border-border-base bg-surface-2 p-3">
                <Markdown>{body || '—'}</Markdown>
              </div>
            ) : (
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
            )}
          </div>

          <Field label={t('tags')}>
            <Input
              name="tags"
              defaultValue={note?.tagNames.join(', ') ?? ''}
              placeholder={t('tagsHint')}
            />
          </Field>

          <div className="flex justify-between gap-2">
            {note ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await removeNote(note.id)
                    toast.success(t('deleted'))
                    setOpen(false)
                  })
                }
              >
                <Trash2 className="size-4" />
                {tc('delete')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={pending}>
                {tc('save')}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function NoteCard({ note }: { note: NoteView }) {
  const t = useTranslations('knowledge')

  return (
    <div className="rounded-[var(--radius)] border border-border-base bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate font-medium">{note.title}</h3>
        <Badge tone={note.type === 'bookmark' ? 'accent' : 'neutral'}>
          {t(`types.${note.type}`)}
        </Badge>
      </div>

      {note.bodyMd ? (
        <p className="mt-1 line-clamp-3 text-sm text-text-subtle">{note.bodyMd}</p>
      ) : null}

      {note.url ? (
        <a
          href={note.url}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-2 block truncate text-xs text-accent hover:underline"
        >
          {note.url}
        </a>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {note.tagNames.map((tag) => (
          <Badge key={tag}>#{tag}</Badge>
        ))}
        <div className="ml-auto">
          <NoteEditor
            note={note}
            trigger={
              <Button variant="ghost" size="sm" className="h-7 px-2">
                <Pencil className="size-3.5" />
              </Button>
            }
          />
        </div>
      </div>
    </div>
  )
}
