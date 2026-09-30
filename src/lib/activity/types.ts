/**
 * What the activity log records, and the only vocabulary it accepts.
 *
 * Spelled out per object rather than multiplied out of an entity list and a
 * verb list. The cross product was shorter to write and wrong: it claimed
 * `session.restore` and `transaction.login` exist, so every one of them needed
 * a label nobody would ever read, and a typo in a real one looked like any
 * other member of the set.
 *
 * Adding a kind of record is a line here plus a label in `messages/*.json` —
 * which is the point. A log nobody can label is a log nobody reads, and
 * `tests/unit/activity.test.ts` refuses the one without the other.
 */
export const ACTIVITY_ACTIONS = {
  transaction: ['create', 'update', 'delete', 'restore'],
  account: ['create', 'update', 'delete'],
  category: ['create', 'update', 'delete'],
  habit: ['create', 'update', 'delete', 'restore'],
  person: ['create', 'update', 'delete', 'restore'],
  goal: ['create', 'update', 'delete'],
  note: ['create', 'update', 'delete'],
  daily: ['update'],
  /**
   * Not a record anybody edits — the two moments an account is used. They are
   * here because a trail of what changed without who was present to change it
   * answers half a question.
   */
  session: ['login', 'logout'],
  /**
   * Who could read a room, and when that changed. The messages themselves are
   * deliberately absent — a log of every line said, inside a log of what
   * changed, buries the entries anybody actually looks for. These are the
   * access-control moments, held to the same standard as signing in.
   */
  chatRoom: ['create', 'join', 'leave', 'invite', 'remove'],
} as const

export type ActivityEntity = keyof typeof ACTIVITY_ACTIONS

/** Every `<entity>.<verb>` this app can write, and nothing else. */
export type ActivityAction = {
  [E in ActivityEntity]: `${E}.${(typeof ACTIVITY_ACTIONS)[E][number]}`
}[ActivityEntity]

/** Flat list, for tests and for walking the vocabulary. */
export const EVERY_ACTIVITY_ACTION = Object.entries(ACTIVITY_ACTIONS).flatMap(([entity, verbs]) =>
  (verbs as readonly string[]).map((verb) => `${entity}.${verb}` as ActivityAction),
)

/**
 * One row reduced to the handful of fields worth remembering, rendered the way
 * a person reads them. Building it is the domain's job — only the code that
 * knows a `categoryId` names "Ăn uống" can write that down.
 *
 * A field left out is a field the trail does not follow. That is the whole
 * privacy control: the body of a journal entry is not missing by accident, it
 * is missing because no snapshot ever puts it in.
 */
export type Snapshot = Record<string, string | null>

/**
 * One field that moved, as a person reads it. Worked out when the trail is
 * read, never stored — see `ActivityRecord` for why.
 */
export type ActivityChange = {
  /** Key under `activity.fields` in the message files, never a column name. */
  field: string
  from: string | null
  to: string | null
}

export type ActivityRecord = {
  /** Scoped like everything else here: a log is personal data too. */
  userId: string
  at: Date
  action: ActivityAction
  /** Which row it was about, so a trail can be followed back to a record. */
  entityId?: string | null
  /**
   * What a person would call it — "Ăn tối", "Đọc sách". Never an amount and
   * never the contents of a journal entry: a log that quotes what it watched
   * is a second copy of the thing it was supposed to be a record *about*.
   */
  label?: string | null
  /** Ties a row to the server console lines and the alert for one request. */
  requestId?: string | null

  /**
   * The row as it stood before the action. A create has none — nothing stood
   * there yet.
   */
  current?: Snapshot | null
  /**
   * What the action was asked to make it. A delete has none: it asks for the
   * row to stop existing, not for it to hold something else.
   *
   * The two are kept rather than the difference between them. A difference is
   * a reading of the facts, and a reading can be improved — a field renamed, a
   * number formatted differently, a mistake in how two values were compared.
   * Keep only the reading and the facts are gone; keep the facts and every
   * later reading is available, including ones this deploy has not thought of.
   */
  request?: Snapshot | null
}

/** One page of the trail, shaped like every other cursor-paged list here. */
export type ActivityPage = {
  items: ActivityView[]
  /** Opaque; null when this page is the end. */
  nextCursor: string | null
}

/** The same page once the reading side has worked out what each row means. */
export type ActivityFeed = {
  items: ActivityEntry[]
  nextCursor: string | null
}

/** What a store hands back: the facts as they were written, nothing derived. */
export type ActivityView = {
  id: string
  at: string
  action: ActivityAction
  entityId: string | null
  label: string | null
  current: Snapshot | null
  request: Snapshot | null
}

/** What the reading side hands the UI: the same row, plus what it means. */
export type ActivityEntry = ActivityView & { changes: ActivityChange[] }

const KNOWN = new Set<string>(EVERY_ACTIVITY_ACTION)

/** A stored action from an older deploy may name something this build dropped. */
export function isActivityAction(value: unknown): value is ActivityAction {
  return typeof value === 'string' && KNOWN.has(value)
}

/** The object half of an action, for the registry's per-object switch. */
export function entityOf(action: ActivityAction): ActivityEntity {
  return action.split('.')[0] as ActivityEntity
}
