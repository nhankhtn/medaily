import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { personPhotos } from '@/lib/db/schema'
import type { PersonPhoto } from '@/lib/db/schema'

export async function findPersonPhotos(userId: string, personIds: string[]): Promise<PersonPhoto[]> {
  if (personIds.length === 0) return []
  return db
    .select()
    .from(personPhotos)
    .where(and(eq(personPhotos.userId, userId), inArray(personPhotos.personId, personIds)))
    .orderBy(desc(personPhotos.createdAt))
}

export async function insertPersonPhoto(
  values: typeof personPhotos.$inferInsert,
): Promise<PersonPhoto> {
  const rows = await db.insert(personPhotos).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert photo')
  return row
}

export async function findPersonPhoto(userId: string, photoId: string): Promise<PersonPhoto | null> {
  const rows = await db
    .select()
    .from(personPhotos)
    .where(and(eq(personPhotos.userId, userId), eq(personPhotos.id, photoId)))
    .limit(1)
  return rows[0] ?? null
}

export async function deletePersonPhoto(userId: string, photoId: string): Promise<void> {
  await db
    .delete(personPhotos)
    .where(and(eq(personPhotos.userId, userId), eq(personPhotos.id, photoId)))
}

export async function updatePersonPhoto(
  userId: string,
  photoId: string,
  patch: { caption?: string | null; takenOn?: string | null },
): Promise<void> {
  await db
    .update(personPhotos)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(personPhotos.userId, userId), eq(personPhotos.id, photoId)))
}
