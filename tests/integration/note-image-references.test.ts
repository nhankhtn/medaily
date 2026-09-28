import { eq } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { insertUser } from '@/server/repositories/auth'
import { findTextMatching, textColumnsByTable } from '@/server/repositories/text-scan'

/**
 * What stands between the image sweep and deleting a picture that is still on
 * screen. The claim is that a Cloudinary id written into any text field comes
 * back out of this search — whichever table and whichever column it landed in.
 */
const describeDb = process.env.DATABASE_URL ? describe : describe.skip

describeDb('finding note images that are still referenced', () => {
  const users: string[] = []

  afterAll(async () => {
    for (const id of users) await db.delete(schema.users).where(eq(schema.users.id, id))
  })

  const urlFor = (folder: string, id: string) =>
    `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto:good,c_limit,w_2000/${folder}/${id}`

  const idsIn = async (folder: string, tables: string[]) => {
    const columnsOf = await textColumnsByTable()
    const finder = new RegExp(`${folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([A-Za-z0-9_-]+)`, 'g')
    const found = new Set<string>()
    for (const table of tables) {
      const blob = await findTextMatching(table, columnsOf.get(table) ?? [], `%${folder}/%`)
      if (!blob) continue
      for (const match of blob.matchAll(finder)) found.add(match[1]!)
    }
    return found
  }

  it('finds an id whichever table and column it was written into', async () => {
    const user = await insertUser({ displayName: 'sweep fixture' })
    users.push(user.id)
    const folder = `medaily/${user.id}/notes/${user.id}`

    await db.insert(schema.notes).values({
      userId: user.id,
      title: 'has a picture',
      bodyMd: `before ![a](${urlFor(folder, 'inNoteBody')}) after`,
      type: 'note',
    })
    await db.insert(schema.journalEntries).values({
      userId: user.id,
      entryDate: new Date().toISOString().slice(0, 10),
      title: 'also has one',
      bodyMd: `![b](${urlFor(folder, 'inJournalBody')})`,
    })

    const found = await idsIn(folder, ['notes', 'journal_entries'])

    expect(found.has('inNoteBody')).toBe(true)
    expect(found.has('inJournalBody')).toBe(true)
    // Nothing invented: an id nobody wrote must not come back, or the sweep
    // would spare rubbish forever.
    expect(found.has('neverWritten')).toBe(false)
    /*
     * `notes` and `journal_entries` carry generated tsvector columns. Casting a
     * whole row to text renders those too, and a tsvector lower-cases its
     * lexemes — which is why the search reads character columns by name.
     */
    expect(found.has('innotebody')).toBe(false)
  })

  it('returns nothing for a folder no one has written about', async () => {
    const user = await insertUser({ displayName: 'sweep fixture, empty' })
    users.push(user.id)

    const found = await idsIn(`medaily/${user.id}/notes/${user.id}`, ['notes', 'journal_entries'])
    expect(found.size).toBe(0)
  })
})
