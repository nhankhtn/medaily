import type { ActivityEntity } from './types'

/**
 * Which objects the trail follows.
 *
 * This is the whole configuration. Switching an entity off here stops every
 * action about it from being recorded — one line rather than an edit in each
 * of the files that touch it, and nothing to miss.
 *
 * Four are on, and the line between them and the rest is money: a
 * transaction, the account it sat in, the category it was filed under — the
 * records where "who changed this, and from what" is a question worth being
 * able to answer months later. Sign-in and sign-out join them because a trail
 * of what changed, with nobody present to have changed it, answers half a
 * question; it is also the half that matters first when an account is used
 * from somewhere its owner did not expect.
 *
 * Everything else is off. Habits, people, goals, notes and chat rooms are
 * edited the way a notebook is — often, casually, and by the one person who
 * would be reading the trail. Recording them buries the entry somebody
 * actually opened the log to find under a wall of things they already
 * remember doing. `daily` was off from the start for that reason and the
 * others have joined it.
 *
 * Off means not written, not removed: the vocabulary, the labels and the
 * `audited()` wrappers all stay, so turning one back on is this one line.
 */
export const AUDITED_ENTITIES: Record<ActivityEntity, boolean> = {
  transaction: true,
  account: true,
  category: true,
  habit: false,
  person: false,
  goal: false,
  note: false,
  daily: false,
  session: true,
  /**
   * On, and the messages are not in the vocabulary at all. Being added to or
   * removed from a room is who can read what — the same kind of fact as a
   * sign-in, and the one a person would come looking for.
   */
  chatRoom: false,
}

/** Whether a given action is recorded at all, read from the entity it is about. */
export function isAudited(entity: ActivityEntity): boolean {
  return AUDITED_ENTITIES[entity]
}
