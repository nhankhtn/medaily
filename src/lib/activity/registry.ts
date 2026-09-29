import type { ActivityEntity } from './types'

/**
 * Which objects the trail follows.
 *
 * This is the whole configuration. Switching an entity off here stops every
 * action about it from being recorded — one line rather than an edit in each
 * of the files that touch it, and nothing to miss.
 *
 * `daily` is off because the daily log is edited all day: a person opens it at
 * noon, adds a number at three, fixes a typo at nine, and each of those is a
 * save. Recording them buries the entries someone actually looks for — a
 * deleted transaction, a person removed — under a wall of "daily changed".
 * Turn it on if what you want is a keystroke log; it is not what this is.
 *
 * `session` is on because a trail of what changed, with nobody present to have
 * changed it, answers half a question. It is also the half that matters first
 * when an account is used from somewhere its owner did not expect.
 */
export const AUDITED_ENTITIES: Record<ActivityEntity, boolean> = {
  transaction: true,
  account: true,
  category: true,
  habit: true,
  person: true,
  goal: true,
  note: true,
  daily: false,
  session: true,
}

/** Whether a given action is recorded at all, read from the entity it is about. */
export function isAudited(entity: ActivityEntity): boolean {
  return AUDITED_ENTITIES[entity]
}
