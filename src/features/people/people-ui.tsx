'use client'

import { Cake, Check, MessageCircle, Plus, Trash2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { Select } from '@/components/ui/select'
import { Field } from '@/features/projects/project-dialog'
import { BANKS } from '@/lib/finance/banks'
import { fromISODate, type ISODate } from '@/lib/dates'
import {
  archivePerson,
  createReminder,
  logInteraction,
  markReminderDone,
  restorePerson,
  savePerson,
} from '@/server/actions/people'
import type { PeopleData, PersonView } from '@/server/services/people'

const RELATIONSHIPS = ['partner', 'family', 'friend', 'colleague', 'mentor', 'other'] as const
const CHANNELS = ['in_person', 'call', 'message', 'email', 'other'] as const

export function PersonDialog({ person, trigger }: { person?: PersonView; trigger?: React.ReactNode }) {
  const t = useTranslations('people')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [notes, setNotes] = useState(person?.notes ?? '')
  const [confirming, setConfirming] = useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        setConfirming(false)
        if (next) setNotes(person?.notes ?? '')
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" />
            {t('addPerson')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={person ? tc('edit') : t('addPerson')}>
        <form
          action={(formData) =>
            startTransition(async () => {
              const interval = String(formData.get('contactIntervalDays') ?? '').trim()
              const result = await savePerson({
                id: person?.id,
                name: String(formData.get('name') ?? ''),
                relationship: formData.get('relationship'),
                company: String(formData.get('company') ?? ''),
                role: String(formData.get('role') ?? ''),
                birthday: String(formData.get('birthday') ?? '') || null,
                phone: String(formData.get('phone') ?? ''),
                email: String(formData.get('email') ?? ''),
                notes: String(formData.get('notes') ?? ''),
                contactIntervalDays: interval === '' ? null : Number(interval),
                bankBin: String(formData.get('bankBin') ?? ''),
                bankAccountNumber: String(formData.get('bankAccountNumber') ?? ''),
                bankAccountName: String(formData.get('bankAccountName') ?? ''),
                momoPhone: String(formData.get('momoPhone') ?? ''),
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
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('name')}>
              <Input name="name" defaultValue={person?.name} required autoFocus maxLength={200} />
            </Field>
            <Field label={t('relationship')}>
              <Select name="relationship" defaultValue={person?.relationship ?? 'friend'}>
                {RELATIONSHIPS.map((value) => (
                  <option key={value} value={value}>
                    {t(`relationships.${value}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('company')}>
              <Input name="company" defaultValue={person?.company ?? ''} maxLength={200} />
            </Field>
            <Field label={t('role')}>
              <Input name="role" defaultValue={person?.role ?? ''} maxLength={200} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('birthday')}>
              <Input type="date" name="birthday" defaultValue={person?.birthday ?? ''} />
            </Field>
            <Field label={t('phone')}>
              <Input name="phone" defaultValue={person?.phone ?? ''} maxLength={40} />
            </Field>
            <Field label={t('cadence')}>
              <Input
                type="number"
                name="contactIntervalDays"
                min={1}
                max={3650}
                defaultValue={person?.contactIntervalDays ?? ''}
                placeholder={t('cadenceDays')}
                className="text-center tabular-nums"
              />
            </Field>
          </div>

          <Field label={t('email')}>
            <Input type="email" name="email" defaultValue={person?.email ?? ''} maxLength={200} />
          </Field>

          {/* Only what a transfer needs. Filling any of it is what puts this
              person in the picker when a transaction is paid back. */}
          <div className="border-border-base space-y-3 border-t pt-3">
            <p className="text-text-subtle text-xs">{t('paymentHint')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('bank')}>
                <Select name="bankBin" defaultValue={person?.bankBin ?? ''}>
                  <option value="">—</option>
                  {BANKS.map((bank) => (
                    <option key={bank.bin} value={bank.bin}>
                      {bank.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('accountNumber')}>
                <Input
                  name="bankAccountNumber"
                  defaultValue={person?.bankAccountNumber ?? ''}
                  inputMode="numeric"
                  maxLength={40}
                  className="tabular-nums"
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('accountName')}>
                <Input
                  name="bankAccountName"
                  defaultValue={person?.bankAccountName ?? ''}
                  maxLength={200}
                />
              </Field>
              <Field label={t('momo')}>
                <Input
                  name="momoPhone"
                  defaultValue={person?.momoPhone ?? ''}
                  maxLength={200}
                  placeholder="09… / me.momo.vn/…"
                />
              </Field>
            </div>
          </div>

          <Field label={t('notes')}>
            <input type="hidden" name="notes" value={notes} />
            <MarkdownEditor
              label={t('notes')}
              value={notes}
              onChange={setNotes}
              className="min-h-40"
            />
            <p className="mt-1 text-xs text-text-subtle">{t('notesHint')}</p>
          </Field>

          <div className="flex items-center justify-between gap-2">
            {person ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                // Two taps: the row is only hidden, but the interactions and
                // photos under it go with it and nothing on screen says so.
                onClick={() => {
                  if (!confirming) {
                    setConfirming(true)
                    return
                  }
                  startTransition(async () => {
                    const result = await archivePerson({ id: person.id })
                    if (!result.ok) {
                      toast.error(tc('error'))
                      return
                    }
                    toast.success(t('personRemoved', { name: person.name }), {
                      action: {
                        label: tc('undo'),
                        onClick: () => void restorePerson({ id: person.id }),
                      },
                    })
                    setOpen(false)
                  })
                }}
              >
                <Trash2 className="size-4" />
                {confirming ? t('confirmRemove') : tc('delete')}
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

export function InteractionDialog({
  people,
  today,
  personId,
}: {
  people: PersonView[]
  today: ISODate
  personId?: string
}) {
  const t = useTranslations('people')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  if (people.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <MessageCircle className="size-4" />
          {t('logInteraction')}
        </Button>
      </DialogTrigger>
      <DialogContent title={t('logInteraction')}>
        <form
          action={(formData) =>
            startTransition(async () => {
              const result = await logInteraction({
                personId: String(formData.get('personId') ?? ''),
                occurredOn: String(formData.get('occurredOn') ?? today),
                channel: formData.get('channel'),
                summary: String(formData.get('summary') ?? ''),
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
          <Field label={t('name')}>
            <Select name="personId" defaultValue={personId ?? people[0]?.id} required>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('channel')}>
              <Select name="channel" defaultValue="message">
                {CHANNELS.map((channel) => (
                  <option key={channel} value={channel}>
                    {t(`channels.${channel}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tc('today')}>
              <Input type="date" name="occurredOn" max={today} defaultValue={today} />
            </Field>
          </div>

          <Field label={t('summary')}>
            <Textarea name="summary" rows={3} />
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

export function ReminderPanel({
  reminders,
  people,
  today,
}: {
  reminders: PeopleData['reminders']
  people: PersonView[]
  today: ISODate
}) {
  const t = useTranslations('people')
  const tc = useTranslations('common')
  const format = useFormatter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <Plus className="size-4" />
            {t('addReminder')}
          </Button>
        </DialogTrigger>
        <DialogContent title={t('addReminder')}>
          <form
            action={(formData) =>
              startTransition(async () => {
                const result = await createReminder({
                  title: String(formData.get('title') ?? ''),
                  dueOn: String(formData.get('dueOn') ?? today),
                  personId: String(formData.get('personId') ?? '') || null,
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
            <Field label={t('reminderTitle')}>
              <Input name="title" required autoFocus maxLength={200} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('dueOn')}>
                <Input type="date" name="dueOn" defaultValue={today} />
              </Field>
              <Field label={t('name')}>
                <Select name="personId" defaultValue="">
                  <option value="">—</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
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

      {reminders.length === 0 ? (
        <p className="text-sm text-text-subtle">{t('noReminders')}</p>
      ) : (
        <ul className="divide-y divide-border-base">
          {reminders.map((reminder) => (
            <li key={reminder.id} className="flex items-center gap-3 py-2">
              <button
                type="button"
                disabled={pending}
                aria-label={t('markDone')}
                onClick={() => startTransition(async () => void (await markReminderDone(reminder.id)))}
                className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border-strong hover:bg-good hover:text-accent-text"
              >
                <Check className="size-3" />
              </button>
              <span className="min-w-0 flex-1 truncate text-sm">{reminder.title}</span>
              <span className="shrink-0 text-xs tabular-nums text-text-subtle">
                {format.dateTime(fromISODate(reminder.dueOn), 'dayMonth')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function BirthdayList({ people }: { people: PersonView[] }) {
  const t = useTranslations('people')

  if (people.length === 0) {
    return <p className="text-sm text-text-subtle">{t('noBirthdays')}</p>
  }

  return (
    <ul className="space-y-1.5">
      {people.map((person) => (
        <li key={person.id} className="flex items-center gap-2 text-sm">
          <Cake className="size-4 shrink-0 text-accent" />
          <span className="min-w-0 flex-1 truncate">{person.name}</span>
          <Badge tone={person.birthdayInDays === 0 ? 'good' : 'neutral'}>
            {person.birthdayInDays}d
          </Badge>
        </li>
      ))}
    </ul>
  )
}
