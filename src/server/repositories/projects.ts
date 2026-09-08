import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { focusSessions, projectTasks, projects } from '@/lib/db/schema'
import type { Project, ProjectInsert, ProjectTask, ProjectTaskInsert } from '@/lib/db/schema'

export async function findProjects(
  userId: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<Project[]> {
  return db
    .select()
    .from(projects)
    .where(
      includeArchived
        ? eq(projects.userId, userId)
        : and(eq(projects.userId, userId), isNull(projects.archivedAt)),
    )
    .orderBy(asc(projects.status), desc(projects.updatedAt))
}

export async function findProject(userId: string, projectId: string): Promise<Project | null> {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.id, projectId)))
    .limit(1)
  return rows[0] ?? null
}

export async function insertProject(values: ProjectInsert): Promise<Project> {
  const rows = await db.insert(projects).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert project')
  return row
}

export async function updateProject(
  userId: string,
  projectId: string,
  patch: Partial<ProjectInsert>,
): Promise<Project> {
  const rows = await db
    .update(projects)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(projects.userId, userId), eq(projects.id, projectId)))
    .returning()
  const row = rows[0]
  if (!row) throw new Error('project not found')
  return row
}

export async function findTasks(userId: string, projectId?: string): Promise<ProjectTask[]> {
  return db
    .select()
    .from(projectTasks)
    .where(
      projectId
        ? and(eq(projectTasks.userId, userId), eq(projectTasks.projectId, projectId))
        : eq(projectTasks.userId, userId),
    )
    .orderBy(asc(projectTasks.sortOrder), asc(projectTasks.createdAt))
}

export async function findTask(userId: string, taskId: string): Promise<ProjectTask | null> {
  const rows = await db
    .select()
    .from(projectTasks)
    .where(and(eq(projectTasks.userId, userId), eq(projectTasks.id, taskId)))
    .limit(1)
  return rows[0] ?? null
}

export async function insertTask(values: ProjectTaskInsert): Promise<ProjectTask> {
  const rows = await db.insert(projectTasks).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert task')
  return row
}

export async function updateTask(
  userId: string,
  taskId: string,
  patch: Partial<ProjectTaskInsert>,
): Promise<ProjectTask> {
  const rows = await db
    .update(projectTasks)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(projectTasks.userId, userId), eq(projectTasks.id, taskId)))
    .returning()
  const row = rows[0]
  if (!row) throw new Error('task not found')
  return row
}

export async function deleteTask(userId: string, taskId: string): Promise<void> {
  await db
    .delete(projectTasks)
    .where(and(eq(projectTasks.userId, userId), eq(projectTasks.id, taskId)))
}

/**
 * Time spent is never typed by hand: it is the sum of focus sessions attributed
 * to the project (spec 9), which is what resolves v1's ambiguity about the
 * `time spent` field.
 */
export async function sumProjectMinutes(
  userId: string,
  projectIds: string[],
): Promise<Map<string, number>> {
  if (projectIds.length === 0) return new Map()

  const rows = await db
    .select({
      projectId: focusSessions.projectId,
      minutes: sql<number>`COALESCE(SUM(${focusSessions.minutes}), 0)::int`,
    })
    .from(focusSessions)
    .where(and(eq(focusSessions.userId, userId), inArray(focusSessions.projectId, projectIds)))
    .groupBy(focusSessions.projectId)

  return new Map(rows.filter((row) => row.projectId).map((row) => [row.projectId as string, row.minutes]))
}
