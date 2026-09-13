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
import { PersonNotes } from '@/features/people/person-notes'
import { PersonPhotos } from '@/features/people/person-photos'
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
                  <p className="text-text-subtle text-sm">{t('noReachOut')}</p>
                ) : (
                  <ul className="divide-border-base divide-y">
                    {data.overdue.map((person) => (
                      <li key={person.id} className="flex items-center gap-3 py-2">
                        <span className="min-w-0 flex-1 truncate font-medium">{person.name}</span>
                        <span className="text-text-subtle shrink-0 text-xs">
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
              <ul className="divide-border-base divide-y">
                {data.people.map((person) => (
                  <li key={person.id} className="py-2.5">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="min-w-0 flex-1 truncate font-medium">{person.name}</span>
                      <Badge tone={person.relationship === 'partner' ? 'accent' : 'neutral'}>
                        {t(`relationships.${person.relationship}`)}
                      </Badge>
                      {person.company ? (
                        <span className="text-text-subtle truncate text-xs">{person.company}</span>
                      ) : null}
                      <span className="text-text-subtle text-xs tabular-nums">
                        {person.lastInteractionOn
                          ? format.dateTime(fromISODate(person.lastInteractionOn), {
                              day: 'numeric',
                              month: 'short',
                            })
                          : '—'}
                      </span>
                    </div>
                    <PersonNotes person={person} />
                    <PersonPhotos
                      personId={person.id}
                      personName={person.name}
                      photos={data.photosByPerson.get(person.id) ?? []}
                      enabled={data.photosEnabled}
                    />
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('interactions')} />
            <CardBody>
              <ul className="divide-border-base divide-y">
                {data.interactions.slice(0, 15).map((interaction) => {
                  const person = data.people.find((row) => row.id === interaction.personId)
                  return (
                    <li key={interaction.id} className="flex items-center gap-3 py-2">
                      <span className="text-text-subtle w-16 shrink-0 text-xs tabular-nums">
                        {format.dateTime(fromISODate(interaction.occurredOn), {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                      <span className="shrink-0 text-sm font-medium">{person?.name ?? '—'}</span>
                      <Badge>{t(`channels.${interaction.channel}`)}</Badge>
                      <span className="text-text-muted min-w-0 flex-1 truncate text-sm">
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
