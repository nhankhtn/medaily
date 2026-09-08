'use client'

import { Plus, Star } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select } from '@/components/ui/select'
import type { Resource } from '@/lib/db/schema'
import { saveResource } from '@/server/actions/learning'
import { Field } from '@/features/projects/project-dialog'
import { cn } from '@/lib/utils'

const TYPES = ['book', 'course', 'article', 'video', 'other'] as const
const STATUSES = ['backlog', 'in_progress', 'done', 'dropped'] as const

export function ResourceList({ resources }: { resources: Resource[] }) {
  const t = useTranslations('learning')

  return (
    <div className="space-y-3">
      <ResourceDialog />

      {resources.length === 0 ? (
        <p className="text-sm text-text-subtle">{t('noResources')}</p>
      ) : (
        <ul className="space-y-2">
          {resources.map((resource) => (
            <li key={resource.id}>
              <ResourceRow resource={resource} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ResourceRow({ resource }: { resource: Resource }) {
  const t = useTranslations('learning')
  const [pending, startTransition] = useTransition()

  const cycleStatus = () => {
    const order = [...STATUSES]
    const next = order[(order.indexOf(resource.status) + 1) % order.length] ?? 'backlog'
    startTransition(async () => {
      await saveResource({
        id: resource.id,
        title: resource.title,
        type: resource.type,
        status: next,
        author: resource.author ?? '',
        url: resource.url ?? '',
        progressPercent: resource.progressPercent,
        rating: resource.rating,
      })
    })
  }

  return (
    <div className="rounded-[var(--radius)] border border-border-base bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{resource.title}</p>
          {resource.author ? (
            <p className="truncate text-xs text-text-subtle">{resource.author}</p>
          ) : null}
        </div>
        <button type="button" onClick={cycleStatus} disabled={pending} className="shrink-0">
          <Badge
            tone={
              resource.status === 'done'
                ? 'good'
                : resource.status === 'in_progress'
                  ? 'accent'
                  : 'neutral'
            }
          >
            {t(`resourceStatuses.${resource.status}`)}
          </Badge>
        </button>
      </div>

      {resource.progressPercent !== null ? (
        <Progress className="mt-2" value={resource.progressPercent} label={resource.title} />
      ) : null}

      <div className="mt-2 flex items-center gap-2 text-xs text-text-subtle">
        <span>{t(`resourceTypes.${resource.type}`)}</span>
        {resource.rating ? (
          <span className="flex items-center gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                className={cn(
                  'size-3',
                  i < (resource.rating ?? 0) ? 'fill-warn text-warn' : 'text-border-strong',
                )}
              />
            ))}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function ResourceDialog() {
  const t = useTranslations('learning')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const progress = String(formData.get('progressPercent') ?? '')
      const result = await saveResource({
        title: String(formData.get('title') ?? ''),
        type: formData.get('type'),
        status: formData.get('status'),
        author: String(formData.get('author') ?? ''),
        url: String(formData.get('url') ?? ''),
        progressPercent: progress === '' ? null : Number(progress),
      })
      if (!result.ok) {
        toast.error(tc('error'))
        return
      }
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          {t('addResource')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('addResource')}>
        <form action={submit} className="space-y-3">
          <Field label={tc('add')}>
            <Input name="title" required autoFocus maxLength={300} />
          </Field>
          <Field label={t('author')}>
            <Input name="author" maxLength={200} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('resourceType')}>
              <Select name="type" defaultValue="book">
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`resourceTypes.${type}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('progress')}>
              <Input name="progressPercent" type="number" min={0} max={100} />
            </Field>
          </div>
          <Field label={tc('showMore')}>
            <Select name="status" defaultValue="backlog">
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`resourceStatuses.${status}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="URL">
            <Input name="url" type="url" maxLength={500} />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {tc('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
