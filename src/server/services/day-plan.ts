import { cache } from 'react'
import { addDays, today as todayOf, type ISODate } from '@/lib/dates'
import type { PlannedBlock, ProjectTask, Reminder } from '@/lib/db/schema'
import { findLatestLogBefore } from '@/server/repositories/daily'
import { findPlannedBlocks } from '@/server/repositories/planning'
import { findProjects, findTasksForDay } from '@/server/repositories/projects'
import { findReminders } from '@/server/repositories/people'
import { dayContextOf, getSettings } from '@/server/services/settings'

export type DayTask = ProjectTask & { projectName: string | null; overdue: boolean }

export type DayPlan = {
  date: ISODate
  /** The real today, so the view can say whether it is looking ahead. */
  today: ISODate
  /** The day's list: due then, overdue and still open, or done that day. */
  tasks: DayTask[]
  /** Open, but never given a day. A backlog, not part of the day's plan. */
  unscheduled: DayTask[]
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

  const [tasks, projects, blocks, reminders, previousLog] = await Promise.all([
    findTasksForDay(settings.userId, date, today),
    findProjects(settings.userId),
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

  return {
    date,
    today,
    tasks: tasks.filter((task) => task.dueDate !== null).map(expand),
    unscheduled: tasks.filter((task) => task.dueDate === null).map(expand),
    blocks,
    reminders: reminders.filter((reminder) => reminder.doneAt === null),
    priorityFromYesterday:
      previousLog && previousLog.logDate >= addDays(date, -1)
        ? (previousLog.tomorrowPriority ?? null)
        : null,
  }
})
