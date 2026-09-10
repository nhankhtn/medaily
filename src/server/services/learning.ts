import { cache } from 'react'
import { getCurrentUserId } from '@/lib/auth/current-user'
import type { FocusSession, Resource, Topic } from '@/lib/db/schema'
import { rangeOfLastDays, today as todayOf, type ISODate } from '@/lib/dates'
import {
  findResources,
  findSessions,
  findTimer,
  findTopics,
  sumMinutesByTopic,
  type TopicTotal,
} from '@/server/repositories/learning'
import { findProjects } from '@/server/repositories/projects'
import { dayContextOf, getSettings } from '@/server/services/settings'

export type RunningTimer = {
  startedAt: string
  kind: 'learning' | 'deep_work' | 'project'
  topicId: string | null
  projectId: string | null
  note: string | null
  /** Minutes elapsed at render time; the client keeps counting from here. */
  elapsedMinutes: number
}

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
    findTimer(userId),
  ])

  return {
    today,
    sessions,
    topics,
    resources,
    projects: projects.map((project) => ({ id: project.id, name: project.name })),
    byTopic,
    totalMinutes: byTopic.reduce((sum, entry) => sum + entry.minutes, 0),
    timer: timer
      ? {
          startedAt: timer.startedAt.toISOString(),
          kind: timer.kind,
          topicId: timer.topicId,
          projectId: timer.projectId,
          note: timer.note,
          elapsedMinutes: Math.max(
            0,
            Math.floor((Date.now() - timer.startedAt.getTime()) / 60_000),
          ),
        }
      : null,
  }
})

/** Just the running timer, for the header — cheaper than the whole page payload. */
export const getRunningTimer = cache(async (): Promise<RunningTimer | null> => {
  const timer = await findTimer(await getCurrentUserId())
  if (!timer) return null

  return {
    startedAt: timer.startedAt.toISOString(),
    kind: timer.kind,
    topicId: timer.topicId,
    projectId: timer.projectId,
    note: timer.note,
    elapsedMinutes: Math.max(0, Math.floor((Date.now() - timer.startedAt.getTime()) / 60_000)),
  }
})
