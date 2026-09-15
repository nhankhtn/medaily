'use client'

import { Pencil, Plus } from 'lucide-react'
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
import { createPlannedBlock, removeEvent, saveEvent } from '@/server/actions/planning'
import type { EventForm } from '@/lib/planning/event-form'

const BLOCK_KINDS = ['deep_work', 'learning', 'project', 'exercise', 'other'] as const

/**
 * One event, new or already there.
 *
 * Editing a repeating one moves the whole series: the event is stored as a
 * single row with a rule, so there is nowhere to keep "just this Friday". The
 * form says so rather than letting the change look narrower than it is.
 */
export function EventDialog({ defaultDate, event }: { defaultDate: ISODate; event?: EventForm }) {
  const t = useTranslations('calendar')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [allDay, setAllDay] = useState(event?.allDay ?? false)
  const [date, setDate] = useState<ISODate>(event?.date ?? defaultDate)
  const [repeat, setRepeat] = useState<RecurrenceRule | ''>(event?.recurrenceRule ?? '')
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  const close = () => {
    setOpen(false)
    setAllDay(event?.allDay ?? false)
    setDate(event?.date ?? defaultDate)
    setRepeat(event?.recurrenceRule ?? '')
    setConfirming(false)
  }

  const title = event ? t('editEvent') : t('addEvent')

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        {event ? (
          <button
            type="button"
            aria-label={t('editEvent')}
            className="text-text-subtle hover:bg-surface-2 hover:text-text flex size-7 shrink-0 items-center justify-center rounded-full"
          >
            <Pencil className="size-3.5" />
          </button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" />
            {t('addEvent')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        title={title}
        description={event && repeat ? t('editsWholeSeries') : undefined}
      >
        <form
          action={(formData) =>
            startTransition(async () => {
              const result = await saveEvent({
                ...(event ? { id: event.id } : {}),
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
            <Input
              name="title"
              required
              autoFocus
              maxLength={200}
              defaultValue={event?.title ?? ''}
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label={t('date')}>
              <Input
                type="date"
                name="date"
                value={date}
                onChange={(field) => setDate(field.target.value)}
              />
            </Field>
            <Field label={t('startTime')}>
              <Input
                type="time"
                name="startTime"
                defaultValue={event?.startTime ?? '09:00'}
                disabled={allDay}
              />
            </Field>
            <Field label={t('endTime')}>
              <Input
                type="time"
                name="endTime"
                defaultValue={event?.endTime ?? ''}
                disabled={allDay}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(field) => setAllDay(field.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            {t('allDay')}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('repeat')}>
              <Select
                name="recurrenceRule"
                value={repeat}
                onChange={(field) => setRepeat(field.target.value as RecurrenceRule | '')}
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
                <Input
                  type="date"
                  name="recurrenceUntil"
                  min={date}
                  defaultValue={event?.recurrenceUntil ?? ''}
                />
              </Field>
            ) : null}
          </div>

          <Field label={t('location')}>
            <Input name="location" maxLength={200} defaultValue={event?.location ?? ''} />
          </Field>

          <div className="flex items-center justify-between gap-2">
            {event ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                // Two taps, because a repeating event goes in one go and there
                // is no undo.
                onClick={() => {
                  if (!confirming) {
                    setConfirming(true)
                    return
                  }
                  startTransition(async () => {
                    await removeEvent(event.id)
                    toast.success(t('deleted'))
                    close()
                  })
                }}
              >
                {confirming ? t('confirmDelete') : tc('delete')}
              </Button>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => close()}>
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
