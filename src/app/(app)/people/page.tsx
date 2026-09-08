import { getFormatter, getTranslations } from 'next-intl/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { EmptyState, PageHeader } from '@/components/ui/page'
import {
  BirthdayList,
  InteractionDialog,
  PersonDialog,
  ReminderPanel,
} from '@/features/people/people-ui'
import { fromISODate } from '@/lib/dates'
import { getPeopleData } from '@/server/services/people'

export default async function PeoplePage() {
  const [t, format, data] = await Promise.all([
    getTranslations('people'),
    getFormatter(),
    getPeopleData(),
  ])

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('title')}
        action={
          <div className="flex flex-wrap gap-2">
            <PersonDialog />
            <InteractionDialog people={data.people} today={data.today} />
          </div>
        }
      />

      {data.people.length === 0 ? (
        <EmptyState title={t('noPeople')} body={t('noPeopleBody')} action={<PersonDialog />} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title={t('reachOut')} />
              <CardBody>
                {data.overdue.length === 0 ? (
                  <p className="text-sm text-text-subtle">{t('noReachOut')}</p>
                ) : (
                  <ul className="divide-y divide-border-base">
                    {data.overdue.map((person) => (
                      <li key={person.id} className="flex items-center gap-3 py-2">
                        <span className="min-w-0 flex-1 truncate font-medium">{person.name}</span>
                        <span className="shrink-0 text-xs text-text-subtle">
                          {person.lastInteractionOn
                            ? t('lastContact', {
                                date: format.dateTime(fromISODate(person.lastInteractionOn), {
                                  day: 'numeric',
                                  month: 'short',
                                }),
                              })
                            : t('neverContacted')}
                        </span>
                        <Badge tone="warn">
                          {t('daysOverdue', { days: person.daysOverdue ?? 0 })}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader title={t('birthdays')} />
                <CardBody>
                  <BirthdayList people={data.birthdays} />
                </CardBody>
              </Card>

              <Card>
                <CardHeader title={t('reminders')} />
                <CardBody>
                  <ReminderPanel
                    reminders={data.reminders}
                    people={data.people}
                    today={data.today}
                  />
                </CardBody>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader title={t('title')} />
            <CardBody>
              <ul className="divide-y divide-border-base">
                {data.people.map((person) => (
                  <li key={person.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate font-medium">{person.name}</span>
                    <Badge>{t(`relationships.${person.relationship}`)}</Badge>
                    {person.company ? (
                      <span className="truncate text-xs text-text-subtle">{person.company}</span>
                    ) : null}
                    <span className="text-xs tabular-nums text-text-subtle">
                      {person.lastInteractionOn
                        ? format.dateTime(fromISODate(person.lastInteractionOn), {
                            day: 'numeric',
                            month: 'short',
                          })
                        : '—'}
                    </span>
                    <PersonDialog
                      person={person}
                      trigger={
                        <button type="button" className="text-xs text-accent hover:underline">
                          ···
                        </button>
                      }
                    />
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('interactions')} />
            <CardBody>
              <ul className="divide-y divide-border-base">
                {data.interactions.slice(0, 15).map((interaction) => {
                  const person = data.people.find((row) => row.id === interaction.personId)
                  return (
                    <li key={interaction.id} className="flex items-center gap-3 py-2">
                      <span className="w-16 shrink-0 text-xs tabular-nums text-text-subtle">
                        {format.dateTime(fromISODate(interaction.occurredOn), {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                      <span className="shrink-0 text-sm font-medium">{person?.name ?? '—'}</span>
                      <Badge>{t(`channels.${interaction.channel}`)}</Badge>
                      <span className="min-w-0 flex-1 truncate text-sm text-text-muted">
                        {interaction.summary ?? ''}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
