'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { saveProject } from '@/server/actions/projects'
import type { ProjectView } from '@/server/services/projects'

const STATUSES = ['planned', 'active', 'on_hold', 'done', 'dropped'] as const
const PRIORITIES = ['low', 'medium', 'high'] as const

export function ProjectDialog({
  project,
  goals,
  trigger,
}: {
  project?: ProjectView
  goals: { id: string; name: string }[]
  trigger?: React.ReactNode
}) {
  const t = useTranslations('projects')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveProject({
        id: project?.id,
        name: String(formData.get('name') ?? ''),
        description: String(formData.get('description') ?? ''),
        status: formData.get('status'),
        priority: formData.get('priority'),
        startDate: emptyToNull(formData.get('startDate')),
        endDate: emptyToNull(formData.get('endDate')),
        goalId: emptyToNull(formData.get('goalId')),
        notes: '',
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
            {t('create')}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent title={project ? t('edit') : t('create')}>
        <form action={submit} className="space-y-3">
          <Field label={t('name')}>
            <Input name="name" defaultValue={project?.name} required autoFocus maxLength={200} />
          </Field>

          <Field label={t('description')}>
            <Textarea name="description" defaultValue={project?.description ?? ''} rows={2} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('status')}>
              <Select name="status" defaultValue={project?.status ?? 'active'}>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`statuses.${status}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('priority')}>
              <Select name="priority" defaultValue={project?.priority ?? 'medium'}>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {t(`priorities.${priority}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('startDate')}>
              <Input type="date" name="startDate" defaultValue={project?.startDate ?? ''} />
            </Field>
            <Field label={t('endDate')}>
              <Input type="date" name="endDate" defaultValue={project?.endDate ?? ''} />
            </Field>
          </div>

          <Field label={t('linkedGoal')}>
            <Select name="goalId" defaultValue={project?.goalId ?? ''}>
              <option value="">{t('noGoal')}</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.name}
                </option>
              ))}
            </Select>
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

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? '').trim()
  return text === '' ? null : text
}
