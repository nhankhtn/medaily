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
import Link from 'next/link'
import type { NoteLinkTargets } from '@/lib/knowledge/links'
import { PATHS } from '@/lib/paths'
import type { NoteFilingOptions, NoteView } from '@/server/services/knowledge'

const TYPES = ['note', 'concept', 'bookmark', 'lesson'] as const

export function NoteEditor({
  note,
  trigger,
  topics,
  resources,
}: { note?: NoteView; trigger?: React.ReactNode } & NoteFilingOptions) {
  const t = useTranslations('knowledge')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState(note?.bodyMd ?? '')
  const [type, setType] = useState<string>(note?.type ?? 'note')
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
        learnedOn: String(formData.get('learnedOn') ?? '') || null,
        topicId: String(formData.get('topicId') ?? '') || null,
        resourceId: String(formData.get('resourceId') ?? '') || null,
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

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('type')}>
              <Select name="type" value={type} onChange={(event) => setType(event.target.value)}>
                {TYPES.map((option) => (
                  <option key={option} value={option}>
                    {t(`types.${option}`)}
                  </option>
                ))}
              </Select>
            </Field>
            {type === 'lesson' ? (
              <Field label={t('learnedOn')}>
                <Input name="learnedOn" type="date" defaultValue={note?.learnedOn ?? ''} />
              </Field>
            ) : (
              <Field label={t('url')}>
                <Input name="url" type="url" defaultValue={note?.url ?? ''} maxLength={500} />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('topic')}>
              <Select name="topicId" defaultValue={note?.topicId ?? ''}>
                <option value="">{t('noTopic')}</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('resource')}>
              <Select name="resourceId" defaultValue={note?.resourceId ?? ''}>
                <option value="">{t('noResource')}</option>
                {resources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.title}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t('body')}</span>
              <button
                type="button"
                onClick={() => setPreview((prev) => !prev)}
                className="text-accent flex items-center gap-1 text-xs hover:underline"
              >
                {preview ? <Pencil className="size-3" /> : <Eye className="size-3" />}
                {preview ? tc('edit') : tc('showMore')}
              </button>
            </div>

            {preview ? (
              <div className="border-border-base bg-surface-2 min-h-40 rounded-[var(--radius)] border p-3">
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

export function NoteCard({
  note,
  topics,
  resources,
  targets,
}: { note: NoteView; targets: NoteLinkTargets } & NoteFilingOptions) {
  const t = useTranslations('knowledge')

  return (
    <div className="border-border-base bg-surface flex h-full flex-col rounded-[var(--radius)] border p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate font-medium">
          <Link href={PATHS.note(note.id)} className="hover:text-accent hover:underline">
            {note.title}
          </Link>
        </h3>
        <Badge tone={note.type === 'bookmark' ? 'accent' : 'neutral'}>
          {t(`types.${note.type}`)}
        </Badge>
      </div>

      {note.bodyMd ? (
        <div className="text-text-subtle mt-1 max-h-16 overflow-hidden">
          <Markdown targets={targets}>{note.bodyMd}</Markdown>
        </div>
      ) : null}

      {note.url ? (
        <a
          href={note.url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-accent mt-2 block truncate text-xs hover:underline"
        >
          {note.url}
        </a>
      ) : null}

      {note.topicName || note.resourceTitle ? (
        <p className="text-text-subtle mt-2 flex flex-wrap items-center gap-x-2 text-xs">
          {note.topicName ? <span>{note.topicName}</span> : null}
          {note.topicName && note.resourceTitle ? <span aria-hidden>·</span> : null}
          {note.resourceTitle ? <span className="truncate">{note.resourceTitle}</span> : null}
        </p>
      ) : null}

      {/* `mt-auto` pins this to the bottom, so cards of different content
          length still line their tags and edit button up across a row. */}
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
        {note.tagNames.map((tag) => (
          <Badge key={tag}>#{tag}</Badge>
        ))}
        <div className="ml-auto">
          <NoteEditor
            topics={topics}
            resources={resources}
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
