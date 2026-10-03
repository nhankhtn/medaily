import { and, eq } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { roomInvites, type RoomInvite } from '@/lib/db/schema'

export async function findRoomInvite(id: string, tx: DbOrTx = db): Promise<RoomInvite | null> {
  const rows = await tx.select().from(roomInvites).where(eq(roomInvites.id, id)).limit(1)
  return rows[0] ?? null
}

export async function findPendingRoomInvite(
  roomId: string,
  inviteeId: string,
  tx: DbOrTx = db,
): Promise<RoomInvite | null> {
  const rows = await tx
    .select()
    .from(roomInvites)
    .where(
      and(
        eq(roomInvites.roomId, roomId),
        eq(roomInvites.inviteeId, inviteeId),
        eq(roomInvites.status, 'pending'),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

export async function insertRoomInvite(
  values: { roomId: string; inviterId: string; inviteeId: string },
  tx: DbOrTx = db,
): Promise<RoomInvite | null> {
  const rows = await tx.insert(roomInvites).values(values).returning()
  return rows[0] ?? null
}

export async function answerRoomInvite(
  id: string,
  status: 'accepted' | 'declined',
  tx: DbOrTx = db,
): Promise<void> {
  await tx
    .update(roomInvites)
    .set({ status, answeredAt: new Date() })
    .where(and(eq(roomInvites.id, id), eq(roomInvites.status, 'pending')))
}
