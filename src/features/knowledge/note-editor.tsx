'use client'

import { Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { Markdown } from '@/components/ui/markdown'
import { Select } from '@/components/ui/select'
import { Field } from '@/features/projects/project-dialog'
import type { NoteLinkTargets } from '@/lib/knowledge/links'
import { cn } from '@/lib/utils'
import { removeNote, saveNote } from '@/server/actions/knowledge'
import type { NoteFilingOptions, NoteView } from '@/server/services/knowledge'

const TYPES = ['note', 'concept', 'bookmark', 'lesson'] as const

type Mode = 'view' | 'edit'

export function NoteEditor({
  note,
  trigger,
  topics,
  resources,
  targets,
  /** Existing notes open in view; new notes always start in edit. */
  defaultMode,
}: {
  note?: NoteView
  trigger?: React.ReactNode
  targets?: NoteLinkTargets
  defaultMode?: Mode
} & NoteFilingOptions) {
  const t = useTranslations('knowledge')
  const tc = useTranslations('common')
  const initialMode: Mode = defaultMode ?? (note ? 'view' : 'edit')
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>(initialMode)
  const [body, setBody] = useState(note?.bodyMd ?? '')
  const [type, setType] = useState<string>(note?.type ?? 'note')
  const [pending, startTransition] = useTransition()

  const openAs = (next: Mode) => {
    setBody(note?.bodyMd ?? '')
    setType(note?.type ?? 'note')
    setMode(note ? next : 'edit')
    setOpen(true)
  }

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
      setMode('view')
      setOpen(false)
    })
  }

  const viewing = mode === 'view' && Boolean(note)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) openAs(initialMode)
        else setOpen(false)
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" />
            {t('newNote')}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        layout="drawer"
        title={viewing ? (note?.title ?? t('newNote')) : note ? t('edit') : t('newNote')}
        description={viewing ? undefined : t('wikiHint')}
      >
        {note ? (
          <ModeSwitch
            mode={mode}
            onChange={setMode}
            viewLabel={t('view')}
            editLabel={t('edit')}
          />
        ) : null}

        {viewing && note ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="glass flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-[var(--radius)] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={note.type === 'bookmark' ? 'accent' : 'neutral'}>
                  {t(`types.${note.type}`)}
                </Badge>
                {note.tagNames.map((tag) => (
                  <Badge key={tag}>#{tag}</Badge>
                ))}
              </div>

              {note.topicName || note.resourceTitle || note.learnedOn ? (
                <p className="text-text-subtle flex flex-wrap items-center gap-x-2 text-xs">
                  {note.topicName ? <span>{note.topicName}</span> : null}
                  {note.topicName && note.resourceTitle ? <span aria-hidden>·</span> : null}
                  {note.resourceTitle ? <span className="truncate">{note.resourceTitle}</span> : null}
                  {note.learnedOn ? (
                    <>
                      {(note.topicName || note.resourceTitle) && <span aria-hidden>·</span>}
                      <span>{note.learnedOn}</span>
                    </>
                  ) : null}
                </p>
              ) : null}

              {note.url ? (
                <a
                  href={note.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-accent block truncate text-sm hover:underline"
                >
                  {note.url}
                </a>
              ) : null}

              <div className="min-h-0 flex-1 overflow-y-auto">
                <Markdown targets={targets}>{body || '—'}</Markdown>
              </div>
            </div>

            <div className="flex shrink-0 justify-between gap-2 pb-1">
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
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  {t('close')}
                </Button>
                <Button type="button" onClick={() => setMode('edit')}>
                  <Pencil className="size-4" />
                  {t('edit')}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <form action={submit} className="flex min-h-0 flex-1 flex-col gap-3">
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

            <Field label={t('tags')}>
              <Input
                name="tags"
                defaultValue={note?.tagNames.join(', ') ?? ''}
                placeholder={t('tagsHint')}
              />
            </Field>

            {/*
             * Body fills what is left and scrolls inside its own box. Without
             * overflow clipping, a flex-grown contenteditable paints over the
             * fields below and looks like one big grey slab that swallowed them.
             */}
            <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
              <span className="shrink-0 text-sm font-medium">{t('body')}</span>
              <MarkdownEditor
                label={t('body')}
                value={body}
                onChange={setBody}
                source
                className="min-h-48 flex-1 overflow-y-auto sm:min-h-56"
              />
            </div>

            <div className="flex shrink-0 justify-between gap-2 pb-1">
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
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => (note ? setMode('view') : setOpen(false))}
                >
                  {note ? t('view') : tc('cancel')}
                </Button>
                <Button type="submit" disabled={pending}>
                  {tc('save')}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ModeSwitch({
  mode,
  onChange,
  viewLabel,
  editLabel,
}: {
  mode: Mode
  onChange: (mode: Mode) => void
  viewLabel: string
  editLabel: string
}) {
  return (
    <div
      role="tablist"
      aria-label={`${viewLabel} / ${editLabel}`}
      className="glass mb-1 flex shrink-0 rounded-full p-0.5"
    >
      {(
        [
          { id: 'view' as const, label: viewLabel, icon: Eye },
          { id: 'edit' as const, label: editLabel, icon: Pencil },
        ] as const
      ).map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={mode === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            'inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors',
            mode === option.id
              ? 'glass-strong font-medium text-text'
              : 'text-text-muted hover:text-text',
          )}
        >
          <option.icon className="size-3.5" />
          {option.label}
        </button>
      ))}
    </div>
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
    <Card className="flex h-full flex-col">
      <CardBody className="flex h-full flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate font-medium">
            <NoteEditor
              topics={topics}
              resources={resources}
              targets={targets}
              note={note}
              defaultMode="view"
              trigger={
                <button
                  type="button"
                  className="hover:text-accent truncate text-left hover:underline"
                >
                  {note.title}
                </button>
              }
            />
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
          <div className="ml-auto flex items-center gap-0.5">
            <NoteEditor
              topics={topics}
              resources={resources}
              targets={targets}
              note={note}
              defaultMode="view"
              trigger={
                <Button variant="ghost" size="sm" className="px-2" aria-label={t('view')}>
                  <Eye className="size-3.5" />
                </Button>
              }
            />
            <NoteEditor
              topics={topics}
              resources={resources}
              targets={targets}
              note={note}
              defaultMode="edit"
              trigger={
                <Button variant="ghost" size="sm" className="px-2" aria-label={t('edit')}>
                  <Pencil className="size-3.5" />
                </Button>
              }
            />
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
