import { and, gt, lt, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { authHandoffs } from '@/lib/db/schema'

const TTL_MS = 3 * 60 * 1000

function randomCode(): string {
  // Six digits, never leading-zero-stripped — typed on a phone keypad.
  return String(Math.floor(100000 + Math.random() * 900000))
}

/** Issue a short code the home-screen PWA can type to claim this Safari session. */
export async function createAuthHandoff(userId: string, email: string): Promise<string> {
  // Drop expired rows opportunistically so the table stays small.
  await db.delete(authHandoffs).where(lt(authHandoffs.expiresAt, new Date()))

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode()
    try {
      await db.insert(authHandoffs).values({
        code,
        userId,
        email,
        expiresAt: new Date(Date.now() + TTL_MS),
      })
      return code
    } catch {
      // Unique collision on the code — try another.
    }
  }
  throw new Error('could not allocate handoff code')
}

/** Consume a code once. Returns null when missing, expired, or already used. */
export async function claimAuthHandoff(
  code: string,
): Promise<{ userId: string; email: string } | null> {
  const normalized = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(normalized)) return null

  const [row] = await db
    .delete(authHandoffs)
    .where(and(eq(authHandoffs.code, normalized), gt(authHandoffs.expiresAt, new Date())))
    .returning({ userId: authHandoffs.userId, email: authHandoffs.email })

  return row ?? null
}
