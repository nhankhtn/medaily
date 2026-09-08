import { cache } from 'react'
import { getCurrentUserId } from '@/lib/auth/current-user'
import type { Interaction, Person, Reminder } from '@/lib/db/schema'
import { addDays, diffDays, today as todayOf, type ISODate } from '@/lib/dates'
import {
  findInteractions,
  findPeople,
  findReminders,
  lastInteractionByPerson,
} from '@/server/repositories/people'
import { dayContextOf, getSettings } from '@/server/services/settings'

export type PersonView = Person & {
  lastInteractionOn: ISODate | null
  daysSinceContact: number | null
  /** Positive when the desired cadence has been exceeded. */
  daysOverdue: number | null
  birthdayInDays: number | null
}

export type PeopleData = {
  today: ISODate
  people: PersonView[]
  overdue: PersonView[]
  birthdays: PersonView[]
  interactions: Interaction[]
  reminders: Reminder[]
}

export const getPeopleData = cache(async (): Promise<PeopleData> => {
  const settings = await getSettings()
  const userId = getCurrentUserId()
  const today = todayOf(dayContextOf(settings))

  const [rows, lastByPerson, interactions, reminders] = await Promise.all([
    findPeople(userId),
    lastInteractionByPerson(userId),
    findInteractions(userId),
    findReminders(userId, addDays(today, 30)),
  ])

  const views = rows.map((person): PersonView => {
    const lastInteractionOn = lastByPerson.get(person.id) ?? null
    const daysSinceContact = lastInteractionOn ? diffDays(today, lastInteractionOn) : null

    return {
      ...person,
      lastInteractionOn,
      daysSinceContact,
      daysOverdue:
        person.contactIntervalDays && daysSinceContact !== null
          ? daysSinceContact - person.contactIntervalDays
          : null,
      birthdayInDays: daysUntilBirthday(person.birthday, today),
    }
  })

  return {
    today,
    people: views,
    // The whole point of a personal CRM: being told when it has been too long.
    overdue: views
      .filter((person) => (person.daysOverdue ?? 0) > 0)
      .sort((a, b) => (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0)),
    birthdays: views
      .filter((person) => person.birthdayInDays !== null && person.birthdayInDays <= 30)
      .sort((a, b) => (a.birthdayInDays ?? 0) - (b.birthdayInDays ?? 0)),
    interactions,
    reminders,
  }
})

function daysUntilBirthday(birthday: string | null, today: ISODate): number | null {
  if (!birthday) return null

  const [, month, day] = birthday.split('-')
  if (!month || !day) return null

  const year = Number(today.slice(0, 4))
  const thisYear = `${year}-${month}-${day}`
  const target = thisYear >= today ? thisYear : `${year + 1}-${month}-${day}`
  return diffDays(target, today)
}
