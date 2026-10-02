import { log } from '@/lib/log'
import {
  CHANNEL_STALE_MS,
  MAX_DELETES_PER_RUN,
  readAt,
  selectStale,
  TYPING_STALE_MS,
  type SweepDoc,
} from '@/lib/realtime/gc'
import { firestoreRest, readFirestoreAdminConfig, type FirestoreRest } from './firestore-rest'

/**
 * Removes what the doorbell leaves behind. Server-side because after
 * `rotateDoorbell` nobody holds the old key, so no browser can reach that
 * document even to delete it.
 *
 * **Order matters:** Firestore does not delete sub-collections with their
 * document, so the typing claims under a channel go first. See
 * docs/reference/realtime/housekeeping.md for the guards and what this costs.
 */
const CHANNELS = 'channels'

export type SweepResult = {
  channels: number
  typing: number
  /** Documents with no readable `at`, left alone rather than guessed at. */
  skipped: number
  /** True when the run stopped at the cap with work still to do. */
  capped: boolean
}

const EMPTY: SweepResult = { channels: 0, typing: 0, skipped: 0, capped: false }

/** `null` when no service account is configured — the ordinary case. */
export async function sweepRealtimeChannels(now = Date.now()): Promise<SweepResult | null> {
  const config = readFirestoreAdminConfig()
  if (!config) return null

  const client = await firestoreRest(config)
  const channels = await client.list(CHANNELS)
  if (channels.length === 0) return EMPTY

  const result = { ...EMPTY }
  let budget = MAX_DELETES_PER_RUN

  for (const channel of channels) {
    if (budget <= 0) {
      result.capped = true
      break
    }

    // `.../documents/channels/{id}` → the id, for addressing its sub-collection.
    const id = channel.name.split('/').pop()
    if (!id) continue

    const at = readAt(channel.fields)
    if (at === null) result.skipped += 1
    const dead = at !== null && Math.abs(now - at) >= CHANNEL_STALE_MS

    const claims: SweepDoc[] = (await client.list(`${CHANNELS}/${id}/typing`)).map((doc) => ({
      path: doc.name,
      at: readAt(doc.fields),
    }))

    // A dying channel takes every claim under it; one that stays keeps the
    // fresh ones. A claim left behind is orphaned beyond reach.
    let doomed: string[]
    if (dead) {
      doomed = [...claims.map((claim) => claim.path)].sort()
    } else {
      const stale = selectStale(claims, now, TYPING_STALE_MS)
      doomed = stale.paths
      result.skipped += stale.skipped
    }

    const removed = await removeAll(client, doomed.slice(0, budget))
    result.typing += removed
    budget -= removed

    if (!dead) continue

    if (budget <= 0) {
      // Claims gone, channel left. Tomorrow's run finishes it.
      result.capped = true
      break
    }

    await client.remove(channel.name)
    result.channels += 1
    budget -= 1
  }

  log.info('realtime', 'channel sweep completed', result)
  return result
}

/** Deletes in sequence and reports how many went. */
async function removeAll(client: FirestoreRest, paths: string[]): Promise<number> {
  let removed = 0
  for (const path of paths) {
    await client.remove(path)
    removed += 1
  }
  return removed
}
