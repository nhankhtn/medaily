'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { isoDateSchema } from '@/lib/validation/daily'
import {
  deleteTask,
  findTask,
  insertProject,
  insertTask,
  updateProject,
  updateTask,
} from '@/server/repositories/projects'

const optionalDate = isoDateSchema.nullable().optional()
const optionalText = z
  .string()
  .max(4000)
  .transform((value) => (value.trim() === '' ? null : value.trim()))
  .nullable()
  .optional()

const projectSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: optionalText,
  status: z.enum(['planned', 'active', 'on_hold', 'done', 'dropped']).default('active'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  startDate: optionalDate,
  endDate: optionalDate,
  goalId: z.string().uuid().nullable().optional(),
  notes: optionalText,
})

export async function saveProject(input: unknown) {
  const parsed = projectSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const userId = getCurrentUserId()
  const { id, ...values } = parsed.data

  const project = id
    ? await updateProject(userId, id, values)
    : await insertProject({ ...values, userId })

  revalidatePath('/projects')
  revalidatePath(`/projects/${project.id}`)
  return { ok: true as const, id: project.id }
}

export async function archiveProject(input: unknown) {
  const id = z.string().uuid().parse(input)
  await updateProject(getCurrentUserId(), id, { archivedAt: new Date() })
  revalidatePath('/projects')
  return { ok: true }
}

const taskSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(300),
  status: z.enum(['todo', 'doing', 'blocked', 'done']).default('todo'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: optionalDate,
  estimateMinutes: z.number().int().min(0).max(10080).nullable().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
})

export async function saveTask(input: unknown) {
  const parsed = taskSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const userId = getCurrentUserId()
  const { id, ...values } = parsed.data

  // `completed_at` follows the status, so "done" always carries its timestamp.
  const completedAt = values.status === 'done' ? new Date() : null

  const task = id
    ? await updateTask(userId, id, { ...values, completedAt })
    : await insertTask({ ...values, userId, completedAt })

  revalidatePath('/projects')
  revalidatePath(`/projects/${values.projectId}`)
  return { ok: true as const, id: task.id }
}

export async function toggleTask(input: unknown) {
  const id = z.string().uuid().parse(input)
  const userId = getCurrentUserId()

  const task = await findTask(userId, id)
  if (!task) return { ok: false as const }

  const done = task.status === 'done'
  await updateTask(userId, id, {
    status: done ? 'todo' : 'done',
    completedAt: done ? null : new Date(),
  })

  revalidatePath('/projects')
  revalidatePath(`/projects/${task.projectId}`)
  return { ok: true as const, done: !done }
}

export async function removeTask(input: unknown) {
  const id = z.string().uuid().parse(input)
  const userId = getCurrentUserId()
  const task = await findTask(userId, id)
  if (!task) return { ok: false }

  await deleteTask(userId, id)
  revalidatePath('/projects')
  revalidatePath(`/projects/${task.projectId}`)
  return { ok: true }
}
