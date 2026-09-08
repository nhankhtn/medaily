/**
 * Spec 29 — authentication is deferred, ownership is not.
 *
 * There is exactly one owner row, seeded by migration with a fixed id. Every
 * repository still takes a `userId` and every query still filters on it, so
 * adding real auth later means implementing this one function against a session
 * and nothing else.
 *
 * The client never supplies a user id. Server Actions read it from here.
 */
export const SINGLE_USER_ID = '00000000-0000-4000-8000-000000000001'

export function getCurrentUserId(): string {
  return SINGLE_USER_ID
}
