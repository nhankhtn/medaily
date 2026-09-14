import { cache } from 'react'
import { getCurrentUserId } from '@/lib/auth/current-user'
import type { Workout } from '@/lib/db/schema'
import { rangeOfLastDays, today as todayOf, type ISODate } from '@/lib/dates'
import { elapsedSeconds } from '@/lib/timer'
import { isActivityId, type ActivityId } from '@/lib/timer/activities'
import { findProjects } from '@/server/repositories/projects'
import { findRecentWorkouts } from '@/server/repositories/health'
import { findSessions, findTopics } from '@/server/repositories/learning'
import { findTimer } from '@/server/repositories/timer'
import { dayContextOf, getSettings } from '@/server/services/settings'

export type RunningTimer = {
  /** Start of the stretch now running; not the start of the whole session. */
  startedAt: string
  pausedAt: string | null
  accumulatedSeconds: number
  /** Elapsed at render time; the client ticks on from here. */
  elapsedSeconds: number
  activity: ActivityId
  mode: 'stopwatch' | 'countdown'
  targetSeconds: number | null
  workoutType: string | null
  topicId: string | null
  projectId: string | null
  note: string | null
}

export type TimerPageData = {
  today: ISODate
  timer: RunningTimer | null
  topics: { id: string; name: string }[]
  projects: { id: string; name: string }[]
  workoutTypes: string[]
  todayFocusMinutes: number
  todayWorkoutMinutes: number
  recentWorkouts: Workout[]
  recentSessions: { id: string; minutes: number; kind: string; sessionDate: ISODate; note: string | null }[]
}

export const getRunningTimer = cache(async (): Promise<RunningTimer | null> => {
  const timer = await findTimer(await getCurrentUserId())
  if (!timer) return null

  return {
    startedAt: timer.startedAt.toISOString(),
    pausedAt: timer.pausedAt?.toISOString() ?? null,
    accumulatedSeconds: timer.accumulatedSeconds,
    elapsedSeconds: elapsedSeconds(timer),
    // A run started by the previous release has no activity; its kind says it.
    activity: isActivityId(timer.activity) ? timer.activity : timer.kind,
    mode: timer.mode,
    targetSeconds: timer.targetSeconds,
    workoutType: timer.workoutType,
    topicId: timer.topicId,
    projectId: timer.projectId,
    note: timer.note,
  }
})

export const getTimerPageData = cache(async (): Promise<TimerPageData> => {
  const settings = await getSettings()
  const userId = await getCurrentUserId()
  const today = todayOf(dayContextOf(settings))

  const [timer, topics, projects, sessions, workouts] = await Promise.all([
    getRunningTimer(),
    findTopics(userId),
    findProjects(userId),
    findSessions(userId, rangeOfLastDays(today, 7), 100),
    findRecentWorkouts(userId, 8),
  ])

  const sumToday = <T,>(rows: T[], date: (row: T) => ISODate, minutes: (row: T) => number) =>
    rows.filter((row) => date(row) === today).reduce((sum, row) => sum + minutes(row), 0)

  return {
    today,
    timer,
    topics: topics.map((topic) => ({ id: topic.id, name: topic.name })),
    projects: projects.map((project) => ({ id: project.id, name: project.name })),
    // Past types, so a regular session is one tap rather than retyping.
    workoutTypes: [...new Set(workouts.map((workout) => workout.type))].slice(0, 8),
    todayFocusMinutes: sumToday(sessions, (s) => s.sessionDate, (s) => s.minutes),
    todayWorkoutMinutes: sumToday(workouts, (w) => w.performedOn, (w) => w.durationMinutes),
    recentWorkouts: workouts.slice(0, 5),
    recentSessions: sessions.slice(0, 5).map((session) => ({
      id: session.id,
      minutes: session.minutes,
      kind: session.kind,
      sessionDate: session.sessionDate,
      note: session.note,
    })),
  }
})
