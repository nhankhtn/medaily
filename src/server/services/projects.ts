import { cache } from 'react'
import { getCurrentUserId } from '@/lib/auth/current-user'
import type { Project, ProjectTask } from '@/lib/db/schema'
import { findGoals } from '@/server/repositories/goals'
import {
  findProject,
  findProjects,
  findTasks,
  sumProjectMinutes,
} from '@/server/repositories/projects'

export type ProjectView = Project & {
  minutesSpent: number
  taskCount: number
  doneTaskCount: number
}

export const getProjectsView = cache(async (): Promise<{
  projects: ProjectView[]
  goals: { id: string; name: string }[]
}> => {
  const userId = getCurrentUserId()
  const [rows, tasks, goals] = await Promise.all([
    findProjects(userId),
    findTasks(userId),
    findGoals(userId),
  ])

  const minutes = await sumProjectMinutes(
    userId,
    rows.map((row) => row.id),
  )

  return {
    projects: rows.map((project) => {
      const own = tasks.filter((task) => task.projectId === project.id)
      return {
        ...project,
        minutesSpent: minutes.get(project.id) ?? 0,
        taskCount: own.length,
        doneTaskCount: own.filter((task) => task.status === 'done').length,
      }
    }),
    goals: goals
      .filter((goal) => goal.status === 'active')
      .map((goal) => ({ id: goal.id, name: goal.name })),
  }
})

export const getProjectDetail = cache(async (
  projectId: string,
): Promise<{ project: ProjectView; tasks: ProjectTask[] } | null> => {
  const userId = getCurrentUserId()
  const project = await findProject(userId, projectId)
  if (!project) return null

  const [tasks, minutes] = await Promise.all([
    findTasks(userId, projectId),
    sumProjectMinutes(userId, [projectId]),
  ])

  return {
    project: {
      ...project,
      minutesSpent: minutes.get(projectId) ?? 0,
      taskCount: tasks.length,
      doneTaskCount: tasks.filter((task) => task.status === 'done').length,
    },
    tasks,
  }
})
