/**
 * A foreign id arrives from a `<select>`, which means it arrives from the
 * client and cannot be trusted. Zod proves it is a uuid; only the database
 * proves it is *yours* (spec 29). An id belonging to someone else is dropped
 * rather than refused — telling a stranger which ids exist is a free
 * directory, and the row being saved is still worth saving.
 *
 * `undefined` stays `undefined`, so a patch that never mentioned the field
 * leaves it alone instead of clearing it.
 */
export async function ownedOrNull<Id extends string | null | undefined>(
  userId: string,
  id: Id,
  owns: (userId: string, id: string) => Promise<unknown | null>,
): Promise<Id extends undefined ? undefined : string | null> {
  type Result = Id extends undefined ? undefined : string | null
  if (id === undefined) return undefined as Result
  if (!id) return null as Result
  return ((await owns(userId, id)) ? id : null) as Result
}
