import { cache } from 'react'
import { getCurrentUserId } from '@/lib/auth/current-user'
import type { FocusSession, Resource, Topic } from '@/lib/db/schema'
import { rangeOfLastDays, today as todayOf, type ISODate } from '@/lib/dates'
import {
  findResources,
  findSessions,
  findTopics,
  sumMinutesByTopic,
  type TopicTotal,
} from '@/server/repositories/learning'
import { findProjects } from '@/server/repositories/projects'
import { dayContextOf, getSettings } from '@/server/services/settings'
import { getRunningTimer, type RunningTimer } from '@/server/services/timer'

export type LearningData = {
  today: ISODate
  sessions: FocusSession[]
  topics: Topic[]
  resources: Resource[]
  projects: { id: string; name: string }[]
  byTopic: TopicTotal[]
  totalMinutes: number
  timer: RunningTimer | null
}

export const getLearningData = cache(async (days = 30): Promise<LearningData> => {
  const settings = await getSettings()
  const userId = await getCurrentUserId()
  const today = todayOf(dayContextOf(settings))
  const range = rangeOfLastDays(today, days)

  const [sessions, topics, resources, projects, byTopic, timer] = await Promise.all([
    findSessions(userId, range),
    findTopics(userId),
    findResources(userId),
    findProjects(userId),
    sumMinutesByTopic(userId, range),
    getRunningTimer(),
  ])

  return {
    today,
    sessions,
    topics,
    resources,
    projects: projects.map((project) => ({ id: project.id, name: project.name })),
    byTopic,
    totalMinutes: byTopic.reduce((sum, entry) => sum + entry.minutes, 0),
    timer,
  }
})
