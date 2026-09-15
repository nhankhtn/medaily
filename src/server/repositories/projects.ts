import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, ne, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { focusSessions, projectTasks, projects } from '@/lib/db/schema'
import type { Project, ProjectInsert, ProjectTask, ProjectTaskInsert } from '@/lib/db/schema'
import type { ISODate } from '@/lib/dates'

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

/**
 * What one day should show: what was due that day, finished or not, plus the
 * undated backlog. A day you cleared has to read as cleared — dropping the
 * finished rows made it look like a day you never planned, and left no way to
 * untick a mistake.
 *
 * Arrears are carried forward onto today and no further. Carrying them onto
 * whatever day you happened to open put a task due next week on a screen for
 * the week after, labelled overdue, on the day it was created. A day ahead of
 * now shows what it is for; only today collects what is late.
 *
 * A task due earlier and ticked today is not pulled forward either.
 * `completed_at` is an instant, and which logical day it falls in depends on
 * the rollover hour, which is the caller's business rather than this query's.
 */
export async function findTasksForDay(
  userId: string,
  date: ISODate,
  today: ISODate,
  limit = 100,
): Promise<ProjectTask[]> {
  return (
    db
      .select()
      .from(projectTasks)
      .where(
        and(
          eq(projectTasks.userId, userId),
          or(
            eq(projectTasks.dueDate, date),
            and(ne(projectTasks.status, 'done'), isNull(projectTasks.dueDate)),
            and(
              sql`${date} = ${today}`,
              ne(projectTasks.status, 'done'),
              lt(projectTasks.dueDate, today),
            ),
          ),
        ),
      )
      // Finished ones last: the day's remaining work is what you came to read.
      .orderBy(
        asc(sql`${projectTasks.status} = 'done'`),
        asc(projectTasks.dueDate),
        asc(projectTasks.sortOrder),
        asc(projectTasks.createdAt),
      )
      .limit(limit)
  )
}

/**
 * Every dated task falling inside a range, finished or not, for the week,
 * month and year grids. Undated ones are left out on purpose: a calendar is
 * made of days, and a task with no day belongs to the backlog.
 */
export async function findTasksInRange(
  userId: string,
  range: { start: ISODate; end: ISODate },
  limit = 500,
): Promise<ProjectTask[]> {
  return db
    .select()
    .from(projectTasks)
    .where(
      and(
        eq(projectTasks.userId, userId),
        gte(projectTasks.dueDate, range.start),
        lte(projectTasks.dueDate, range.end),
      ),
    )
    .orderBy(asc(projectTasks.dueDate), asc(projectTasks.sortOrder), asc(projectTasks.createdAt))
    .limit(limit)
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

  return new Map(
    rows.filter((row) => row.projectId).map((row) => [row.projectId as string, row.minutes]),
  )
}
