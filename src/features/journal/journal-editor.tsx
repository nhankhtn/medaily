'use client'

import { Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Markdown } from '@/components/ui/markdown'
import { Field } from '@/features/projects/project-dialog'
import type { JournalEntry } from '@/lib/db/schema'
import type { ISODate } from '@/lib/dates'
import { removeJournalEntry, saveJournalEntry } from '@/server/actions/knowledge'

export function JournalEditor({
  today,
  entry,
  defaultDate,
  trigger,
}: {
  today: ISODate
  entry?: JournalEntry
  defaultDate?: ISODate
  trigger?: React.ReactNode
}) {
  const t = useTranslations('journal')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState(entry?.bodyMd ?? '')
  const [preview, setPreview] = useState(false)
  const [pending, startTransition] = useTransition()

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveJournalEntry({
        id: entry?.id,
        entryDate: String(formData.get('entryDate') ?? today),
        title: String(formData.get('title') ?? ''),
        bodyMd: body,
        mood: formData.get('mood') ? Number(formData.get('mood')) : null,
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
            {t('newEntry')}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent title={entry ? t('edit') : t('newEntry')}>
        <form action={submit} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label={t('date')}>
              <Input
                type="date"
                name="entryDate"
                max={today}
                defaultValue={entry?.entryDate ?? defaultDate ?? today}
              />
            </Field>
            <div className="col-span-2">
              <Field label={t('entryTitle')}>
                <Input name="title" defaultValue={entry?.title ?? ''} maxLength={200} />
              </Field>
            </div>
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
                {preview ? tc('edit') : t('preview')}
              </button>
            </div>

            {preview ? (
              <div className="min-h-48 rounded-[var(--radius)] border border-border-base bg-surface-2 p-3">
                <Markdown>{body || '—'}</Markdown>
              </div>
            ) : (
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={12}
                required
                autoFocus
              />
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label={t('mood')}>
              <Input
                type="number"
                name="mood"
                min={1}
                max={10}
                defaultValue={entry?.mood ?? ''}
                className="text-center tabular-nums"
              />
            </Field>
            <div className="col-span-2">
              <Field label={t('tags')}>
                <Input
                  name="tags"
                  defaultValue={entry?.tags?.join(', ') ?? ''}
                  placeholder={t('tagsHint')}
                />
              </Field>
            </div>
          </div>

          <div className="flex justify-between gap-2">
            {entry ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await removeJournalEntry(entry.id)
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
                {t('save')}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
