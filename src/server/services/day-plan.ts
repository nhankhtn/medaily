import { cache } from 'react'
import { addDays, fromISODate, toISODate, today as todayOf, type ISODate } from '@/lib/dates'
import type { PlannedBlock, ProjectTask, Reminder } from '@/lib/db/schema'
import { toEventForm, type EventForm } from '@/lib/planning/event-form'
import { expandAll } from '@/lib/planning/recurrence'
import { findLatestLogBefore } from '@/server/repositories/daily'
import { findEvents, findPlannedBlocks } from '@/server/repositories/planning'
import { findProjects, findTasksForDay } from '@/server/repositories/projects'
import { findReminders } from '@/server/repositories/people'
import { dayContextOf, getSettings } from '@/server/services/settings'

export type DayTask = ProjectTask & { projectName: string | null; overdue: boolean }

/** One occurrence on this day, with the stored series the edit form needs. */
export type DayEvent = {
  key: string
  title: string
  startsAt: Date
  allDay: boolean
  location: string | null
  series: EventForm
}

export type DayPlan = {
  date: ISODate
  /** The real today, so the view can say whether it is looking ahead. */
  today: ISODate
  /** The day's list: due then, overdue and still open, or done that day. */
  tasks: DayTask[]
  /** Open, but never given a day. A backlog, not part of the day's plan. */
  unscheduled: DayTask[]
  events: DayEvent[]
  blocks: PlannedBlock[]
  reminders: Reminder[]
  /** What the day before said mattered, which nothing showed until now. */
  priorityFromYesterday: string | null
}

/**
 * One answer to "what am I doing today", assembled from what the app already
 * knows: tasks that are open, time already blocked out, reminders that have
 * come due, and the priority written on the previous day's log.
 */
export const getDayPlan = cache(async (requested?: ISODate): Promise<DayPlan> => {
  const settings = await getSettings()
  const today = todayOf(dayContextOf(settings))
  const date = requested ?? today
  const window = { from: fromISODate(date), to: fromISODate(addDays(date, 1)) }

  const [tasks, projects, eventRows, blocks, reminders, previousLog] = await Promise.all([
    findTasksForDay(settings.userId, date, today),
    findProjects(settings.userId),
    findEvents(settings.userId, window.from, window.to),
    findPlannedBlocks(settings.userId, { start: date, end: date }),
    findReminders(settings.userId, date),
    findLatestLogBefore(settings.userId, date),
  ])

  const nameOf = new Map(projects.map((project) => [project.id, project.name]))
  const expand = (task: ProjectTask): DayTask => ({
    ...task,
    projectName: task.projectId ? (nameOf.get(task.projectId) ?? null) : null,
    // Late as of now, not as of the day being looked at: a task due next
    // week is not overdue because you opened the week after.
    overdue: task.status !== 'done' && task.dueDate !== null && task.dueDate < today,
  })

  const seriesById = new Map(eventRows.map((row) => [row.id, toEventForm(row)]))

  return {
    date,
    today,
    tasks: tasks.filter((task) => task.dueDate !== null).map(expand),
    unscheduled: tasks.filter((task) => task.dueDate === null).map(expand),
    events: expandAll(eventRows, window).map((event) => ({
      key: `${event.id}:${toISODate(event.startsAt)}`,
      title: event.title,
      startsAt: event.startsAt,
      allDay: event.allDay,
      location: event.location,
      series: seriesById.get(event.id) ?? toEventForm(event),
    })),
    blocks,
    reminders: reminders.filter((reminder) => reminder.doneAt === null),
    priorityFromYesterday:
      previousLog && previousLog.logDate >= addDays(date, -1)
        ? (previousLog.tomorrowPriority ?? null)
        : null,
  }
})
