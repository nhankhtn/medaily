'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Field } from '@/features/projects/project-dialog'
import type { ISODate } from '@/lib/dates'
import { RECURRENCE_RULES, type RecurrenceRule } from '@/lib/planning/recurrence'
import { createEvent, createPlannedBlock } from '@/server/actions/planning'

const BLOCK_KINDS = ['deep_work', 'learning', 'project', 'exercise', 'other'] as const

export function EventDialog({ defaultDate }: { defaultDate: ISODate }) {
  const t = useTranslations('calendar')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [allDay, setAllDay] = useState(false)
  const [date, setDate] = useState<ISODate>(defaultDate)
  const [repeat, setRepeat] = useState<RecurrenceRule | ''>('')
  const [pending, startTransition] = useTransition()

  const close = () => {
    setOpen(false)
    setAllDay(false)
    setDate(defaultDate)
    setRepeat('')
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          {t('addEvent')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('addEvent')}>
        <form
          action={(formData) =>
            startTransition(async () => {
              const result = await createEvent({
                title: String(formData.get('title') ?? ''),
                date,
                startTime: allDay ? undefined : String(formData.get('startTime') ?? '09:00'),
                endTime: allDay ? undefined : String(formData.get('endTime') || '') || undefined,
                allDay,
                location: String(formData.get('location') ?? ''),
                note: '',
                recurrenceRule: repeat || null,
                recurrenceUntil: String(formData.get('recurrenceUntil') ?? '') || null,
              })
              if (!result.ok) {
                toast.error(tc('error'))
                return
              }
              toast.success(t('saved'))
              close()
            })
          }
          className="space-y-3"
        >
          <Field label={t('eventTitle')}>
            <Input name="title" required autoFocus maxLength={200} />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label={t('date')}>
              <Input
                type="date"
                name="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Field>
            <Field label={t('startTime')}>
              <Input type="time" name="startTime" defaultValue="09:00" disabled={allDay} />
            </Field>
            <Field label={t('endTime')}>
              <Input type="time" name="endTime" disabled={allDay} />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(event) => setAllDay(event.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            {t('allDay')}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('repeat')}>
              <Select
                name="recurrenceRule"
                value={repeat}
                onChange={(event) => setRepeat(event.target.value as RecurrenceRule | '')}
              >
                <option value="">{t('repeats.none')}</option>
                {RECURRENCE_RULES.map((rule) => (
                  <option key={rule} value={rule}>
                    {t(`repeats.${rule}`)}
                  </option>
                ))}
              </Select>
            </Field>
            {repeat ? (
              <Field label={t('repeatUntil')}>
                <Input type="date" name="recurrenceUntil" min={date} />
              </Field>
            ) : null}
          </div>

          <Field label={t('location')}>
            <Input name="location" maxLength={200} />
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => close()}>
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

export function BlockDialog({
  defaultDate,
  projects,
}: {
  defaultDate: ISODate
  projects: { id: string; name: string }[]
}) {
  const t = useTranslations('calendar')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          {t('addBlock')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('addBlock')} description={t('planNote')}>
        <form
          action={(formData) =>
            startTransition(async () => {
              const result = await createPlannedBlock({
                blockDate: String(formData.get('blockDate') ?? defaultDate),
                startTime: String(formData.get('startTime') ?? '09:00'),
                endTime: String(formData.get('endTime') ?? '10:00'),
                kind: formData.get('kind'),
                projectId: String(formData.get('projectId') ?? '') || null,
                note: String(formData.get('note') ?? ''),
              })
              if (!result.ok) {
                toast.error(tc('error'))
                return
              }
              toast.success(t('saved'))
              setOpen(false)
            })
          }
          className="space-y-3"
        >
          <div className="grid grid-cols-3 gap-3">
            <Field label={t('date')}>
              <Input type="date" name="blockDate" defaultValue={defaultDate} />
            </Field>
            <Field label={t('startTime')}>
              <Input type="time" name="startTime" defaultValue="09:00" required />
            </Field>
            <Field label={t('endTime')}>
              <Input type="time" name="endTime" defaultValue="10:30" required />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('kind')}>
              <Select name="kind" defaultValue="deep_work">
                {BLOCK_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`kinds.${kind}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tc('none')}>
              <Select name="projectId" defaultValue="">
                <option value="">—</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label={t('note')}>
            <Input name="note" maxLength={200} />
          </Field>

          <div className="flex justify-end gap-2">
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
