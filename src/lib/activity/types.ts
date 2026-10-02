/**
 * The only vocabulary the activity log accepts. Spelled out per object, not
 * multiplied out of entities × verbs — that claimed `transaction.login`
 * existed and made a typo look like any other member.
 *
 * A new kind is a line here plus a label in `messages/*.json`;
 * `tests/unit/activity.test.ts` refuses one without the other.
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
  /** What changed, without who was present, answers half a question. */
  session: ['login', 'logout'],
  /**
   * Access-control moments only. The messages are deliberately absent: a log
   * of every line said buries the entries anybody looks for.
   */
  chatRoom: ['create', 'rename', 'delete', 'join', 'leave', 'invite', 'remove'],
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
 * One row reduced to what is worth remembering, rendered as a person reads it
 * — only the domain knows a `categoryId` names "Ăn uống".
 *
 * A field left out is a field the trail does not follow. That is the privacy
 * control: a journal body is missing because no snapshot puts it in.
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
   * "Ăn tối", "Đọc sách". Never an amount or a journal body — a log that
   * quotes what it watched is a second copy of it.
   */
  label?: string | null
  /** Ties a row to the server console lines and the alert for one request. */
  requestId?: string | null

  /** A create has none; nothing stood there. */
  current?: Snapshot | null
  /**
   * What it was asked to become. A delete has none.
   *
   * Both are kept rather than the difference: a difference is a reading, and
   * keeping only the reading throws away every later one.
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
