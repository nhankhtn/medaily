import { describe, expect, it } from 'vitest'
import type { ChatStore } from '@/lib/chat/store'
import { directKeyOf } from '@/lib/chat/types'

const hour = (n: number) => new Date(Date.UTC(2026, 8, 29, n)).toISOString()

/**
 * What every chat adapter must do, run against each of them.
 *
 * The in-memory fake and the MongoDB adapter share this file so that "works in
 * tests" and "works in production" cannot drift apart — the same reason
 * `activity-store.test.ts` and `activity-mongo.test.ts` share theirs.
 */
export function describeChatStore(name: string, makeStore: () => Promise<ChatStore>) {
  describe(`${name}: rooms`, () => {
    it('hands back the room it was given', async () => {
      const store = await makeStore()
      const made = await store.createRoom(room('r1'))

      expect(made.id).toBe('r1')
      expect(await store.findRoom('r1')).toMatchObject({ id: 'r1', kind: 'group' })
    })

    it('answers nothing for a room that is not there', async () => {
      const store = await makeStore()
      expect(await store.findRoom('nope')).toBeNull()
    })

    /**
     * The race that splits a conversation in two. Both people tap "message" at
     * once; the database has to pick one, and the loser has to be able to find
     * what the winner made.
     */
    it('refuses a second direct room for the same pair', async () => {
      const store = await makeStore()
      const key = directKeyOf('u2', 'u1')
      await store.createRoom({ ...room('r1'), kind: 'direct', directKey: key })

      await expect(
        store.createRoom({ ...room('r2'), kind: 'direct', directKey: key }),
      ).rejects.toThrow()
      expect(await store.findRoomByDirectKey(key)).toMatchObject({ id: 'r1' })
    })

    it('builds the same direct key whichever way round the pair is given', () => {
      expect(directKeyOf('a', 'b')).toBe(directKeyOf('b', 'a'))
    })

    it('lets two different pairs each have a direct room', async () => {
      const store = await makeStore()
      await store.createRoom({ ...room('r1'), kind: 'direct', directKey: directKeyOf('u1', 'u2') })
      await store.createRoom({ ...room('r2'), kind: 'direct', directKey: directKeyOf('u1', 'u3') })

      expect(await store.findRoom('r2')).toBeTruthy()
    })

    it('leaves group rooms out of the uniqueness rule entirely', async () => {
      const store = await makeStore()
      await store.createRoom(room('r1'))
      await store.createRoom(room('r2'))

      expect(await store.findRoom('r2')).toBeTruthy()
    })

    it('lists a person rooms, busiest first', async () => {
      const store = await makeStore()
      await store.createRoom(room('quiet'))
      await store.createRoom(room('busy'))
      await store.addMember(seat('quiet', 'u1'))
      await store.addMember(seat('busy', 'u1'))
      await store.touchRoom('quiet', new Date(hour(1)))
      await store.touchRoom('busy', new Date(hour(9)))

      expect((await store.listRoomsFor('u1')).map((r) => r.id)).toEqual(['busy', 'quiet'])
    })

    it('keeps one person rooms out of another person list', async () => {
      const store = await makeStore()
      await store.createRoom(room('r1'))
      await store.addMember(seat('r1', 'u1'))

      expect(await store.listRoomsFor('u2')).toEqual([])
    })

    /** Somebody removed from a room must stop being able to watch it. */
    it('gives the room a new doorbell key on demand', async () => {
      const store = await makeStore()
      const made = await store.createRoom(room('r1'))
      const rotated = await store.rotateDoorbell('r1')

      expect(rotated).not.toBe(made.doorbellKey)
      expect((await store.findRoom('r1'))?.doorbellKey).toBe(rotated)
    })
  })

  describe(`${name}: members`, () => {
    it('seats a person once, however many times it is asked', async () => {
      const store = await makeStore()
      await store.createRoom(room('r1'))
      await store.addMember(seat('r1', 'u1'))
      await store.addMember(seat('r1', 'u1'))

      expect(await store.countMembers('r1')).toBe(1)
    })

    it('knows who is in a room and who never was', async () => {
      const store = await makeStore()
      await store.createRoom(room('r1'))
      await store.addMember(seat('r1', 'u1'))

      expect(await store.findMember('r1', 'u1')).toMatchObject({ role: 'member' })
      expect(await store.findMember('r1', 'stranger')).toBeNull()
    })

    /** Leaving is recorded, not erased: the transcript still has to name them. */
    it('marks a leaver rather than forgetting them', async () => {
      const store = await makeStore()
      await store.createRoom(room('r1'))
      await store.addMember(seat('r1', 'u1'))
      await store.removeMember('r1', 'u1')

      expect((await store.findMember('r1', 'u1'))?.leftAt).toBeTruthy()
      expect(await store.countMembers('r1')).toBe(0)
      expect(await store.listRoomsFor('u1')).toEqual([])
    })

    it('remembers where somebody had read up to', async () => {
      const store = await makeStore()
      await store.createRoom(room('r1'))
      await store.addMember(seat('r1', 'u1'))
      const sent = await store.appendMessage(message('r1', 'u2', 'xin chào', 'c1'))
      await store.markRead('r1', 'u1', sent.id)

      expect((await store.findMember('r1', 'u1'))?.lastReadMessageId).toBe(sent.id)
    })
  })

  describe(`${name}: messages`, () => {
    it('keeps what was written', async () => {
      const store = await makeStore()
      await store.createRoom(room('r1'))
      const sent = await store.appendMessage(message('r1', 'u1', 'xin chào', 'c1'))

      expect(sent).toMatchObject({ roomId: 'r1', userId: 'u1', body: 'xin chào', deletedAt: null })
      expect(sent.id).toBeTruthy()
    })

    /**
     * A send whose reply never arrived gets retried by the browser. The second
     * attempt must return the first message rather than posting it twice.
     */
    it('returns the first message when the same send is retried', async () => {
      const store = await makeStore()
      await store.createRoom(room('r1'))
      const first = await store.appendMessage(message('r1', 'u1', 'xin chào', 'same'))
      const again = await store.appendMessage(message('r1', 'u1', 'xin chào', 'same'))

      expect(again.id).toBe(first.id)
      expect((await store.listBackward('r1', { limit: 50 })).items).toHaveLength(1)
    })

    it('lets two rooms use the same client id', async () => {
      const store = await makeStore()
      await store.createRoom(room('r1'))
      await store.createRoom(room('r2'))
      await store.appendMessage(message('r1', 'u1', 'a', 'c1'))
      await store.appendMessage(message('r2', 'u1', 'b', 'c1'))

      expect((await store.listBackward('r2', { limit: 50 })).items).toHaveLength(1)
    })

    it('reads a room backwards, newest first', async () => {
      const store = await makeStore()
      await store.createRoom(room('r1'))
      for (const n of [1, 2, 3]) await store.appendMessage(message('r1', 'u1', `m${n}`, `c${n}`))

      const page = await store.listBackward('r1', { limit: 2 })
      expect(page.items.map((m) => m.body)).toEqual(['m3', 'm2'])
      expect(page.more).toBe(true)

      const older = await store.listBackward('r1', { before: page.cursor, limit: 2 })
      expect(older.items.map((m) => m.body)).toEqual(['m1'])
      expect(older.more).toBe(false)
    })

    it('reads forward from a cursor, oldest first', async () => {
      const store = await makeStore()
      await store.createRoom(room('r1'))
      const first = await store.appendMessage(message('r1', 'u1', 'm1', 'c1'))
      for (const n of [2, 3]) await store.appendMessage(message('r1', 'u1', `m${n}`, `c${n}`))

      const page = await store.listForward('r1', { after: first.id, limit: 10 })
      expect(page.items.map((m) => m.body)).toEqual(['m2', 'm3'])
      expect(page.more).toBe(false)
    })

    /**
     * The hole-in-the-middle bug. A client back after an hour away gets a
     * capped page; if it stops there and keeps the cursor, the messages it
     * skipped are gone from its view for good.
     */
    it('reports more, and keeps reporting until the catch-up is finished', async () => {
      const store = await makeStore()
      await store.createRoom(room('r1'))
      const first = await store.appendMessage(message('r1', 'u1', 'm0', 'c0'))
      for (let n = 1; n < 250; n++) {
        await store.appendMessage(message('r1', 'u1', `m${n}`, `c${n}`))
      }

      const seen: string[] = []
      let cursor: string | null = first.id
      let more = true
      while (more) {
        const page: Awaited<ReturnType<ChatStore['listForward']>> = await store.listForward('r1', {
          after: cursor,
          limit: 100,
        })
        seen.push(...page.items.map((m) => m.body))
        cursor = page.cursor
        more = page.more
      }

      expect(seen).toHaveLength(249)
      expect(new Set(seen).size, 'no message arrives twice').toBe(249)
      expect(seen[0]).toBe('m1')
      expect(seen.at(-1)).toBe('m249')
    })

    it('reads a room from the top when given no cursor', async () => {
      const store = await makeStore()
      await store.createRoom(room('r1'))
      await store.appendMessage(message('r1', 'u1', 'only', 'c1'))

      expect((await store.listForward('r1', { limit: 10 })).items.map((m) => m.body)).toEqual([
        'only',
      ])
    })

    it('keeps one room messages out of another', async () => {
      const store = await makeStore()
      await store.createRoom(room('r1'))
      await store.createRoom(room('r2'))
      await store.appendMessage(message('r1', 'u1', 'mine', 'c1'))

      expect((await store.listBackward('r2', { limit: 50 })).items).toEqual([])
    })

    it('lets somebody recall their own message', async () => {
      const store = await makeStore()
      await store.createRoom(room('r1'))
      const sent = await store.appendMessage(message('r1', 'u1', 'oops', 'c1'))

      expect(await store.softDeleteMessage('r1', sent.id, 'u1')).toBe(true)
      const [after] = (await store.listBackward('r1', { limit: 50 })).items
      expect(after?.deletedAt).toBeTruthy()
      expect(after?.body, 'the words go, the place they were stays').toBe('')
    })

    it('refuses to recall somebody elses message', async () => {
      const store = await makeStore()
      await store.createRoom(room('r1'))
      const sent = await store.appendMessage(message('r1', 'u1', 'mine', 'c1'))

      expect(await store.softDeleteMessage('r1', sent.id, 'u2')).toBe(false)
      expect((await store.listBackward('r1', { limit: 50 })).items[0]?.body).toBe('mine')
    })
  })

  describe(`${name}: invites`, () => {
    const soon = () => new Date(Date.now() + 3_600_000).toISOString()

    it('spends one use at a time and then stops', async () => {
      const store = await makeStore()
      await store.createInvite(invite('code1', { maxUses: 2, expiresAt: soon() }))

      expect(await store.useInvite('code1', new Date())).toBe(true)
      expect(await store.useInvite('code1', new Date())).toBe(true)
      expect(await store.useInvite('code1', new Date())).toBe(false)
    })

    it('refuses an invite that has expired', async () => {
      const store = await makeStore()
      await store.createInvite(
        invite('old', { expiresAt: new Date(Date.now() - 1000).toISOString() }),
      )

      expect(await store.useInvite('old', new Date())).toBe(false)
    })

    it('refuses an invite that was taken back', async () => {
      const store = await makeStore()
      await store.createInvite(invite('gone', { expiresAt: soon() }))
      await store.revokeInvite('gone')

      expect(await store.useInvite('gone', new Date())).toBe(false)
    })

    it('refuses a code nobody ever issued', async () => {
      const store = await makeStore()
      expect(await store.useInvite('guessed', new Date())).toBe(false)
      expect(await store.findInvite('guessed')).toBeNull()
    })

    /** Someone invited by address finds the room waiting when they first sign in. */
    it('finds the invites addressed to somebody', async () => {
      const store = await makeStore()
      await store.createInvite(invite('a', { email: 'ban@example.com', expiresAt: soon() }))
      await store.createInvite(invite('b', { email: 'khac@example.com', expiresAt: soon() }))

      const found = await store.findInvitesForEmail('ban@example.com', new Date())
      expect(found.map((i) => i.code)).toEqual(['a'])
    })

    it('leaves a spent or expired invite out of what is waiting', async () => {
      const store = await makeStore()
      await store.createInvite(
        invite('spent', { email: 'ban@example.com', expiresAt: soon(), maxUses: 1 }),
      )
      await store.useInvite('spent', new Date())

      expect(await store.findInvitesForEmail('ban@example.com', new Date())).toEqual([])
    })
  })

  describe(`${name}: erasure`, () => {
    it('cuts the author out but leaves the words', async () => {
      const store = await makeStore()
      await store.createRoom(room('r1'))
      await store.appendMessage(message('r1', 'u1', 'ghi lại', 'c1'))
      await store.anonymiseMessagesOf('u1')

      const [left] = (await store.listBackward('r1', { limit: 50 })).items
      expect(left?.userId).toBeNull()
      expect(left?.body).toBe('ghi lại')
    })

    it('leaves other people messages alone', async () => {
      const store = await makeStore()
      await store.createRoom(room('r1'))
      await store.appendMessage(message('r1', 'u2', 'của tôi', 'c1'))
      await store.anonymiseMessagesOf('u1')

      expect((await store.listBackward('r1', { limit: 50 })).items[0]?.userId).toBe('u2')
    })

    it('names the rooms it emptied, so empty ones can be swept', async () => {
      const store = await makeStore()
      await store.createRoom(room('r1'))
      await store.createRoom(room('r2'))
      await store.addMember(seat('r1', 'u1'))
      await store.addMember(seat('r2', 'u1'))

      expect((await store.removeMembershipsOf('u1')).sort()).toEqual(['r1', 'r2'])
      expect(await store.countMembers('r1')).toBe(0)
    })

    it('takes a room messages with the room', async () => {
      const store = await makeStore()
      await store.createRoom(room('r1'))
      await store.appendMessage(message('r1', 'u1', 'bye', 'c1'))
      await store.deleteMessagesIn('r1')
      await store.deleteRoom('r1')

      expect(await store.findRoom('r1')).toBeNull()
      expect((await store.listBackward('r1', { limit: 50 })).items).toEqual([])
    })

    it('takes the invites somebody wrote', async () => {
      const store = await makeStore()
      await store.createInvite(invite('mine', { createdBy: 'u1' }))
      await store.createInvite(invite('theirs', { createdBy: 'u2' }))
      await store.deleteInvitesBy('u1')

      expect(await store.findInvite('mine')).toBeNull()
      expect(await store.findInvite('theirs')).toBeTruthy()
    })
  })
}

function room(id: string) {
  return {
    id,
    kind: 'group' as const,
    title: 'Phòng',
    createdBy: 'u1',
    doorbellKey: `door-${id}`,
    directKey: null,
  }
}

function seat(roomId: string, userId: string) {
  return { roomId, userId, role: 'member' as const, joinedAt: hour(0) }
}

function message(roomId: string, userId: string, body: string, clientId: string) {
  return { roomId, userId, body, clientId }
}

function invite(code: string, over: Partial<Parameters<ChatStore['createInvite']>[0]> = {}) {
  return {
    code,
    roomId: 'r1',
    createdBy: 'u1',
    email: null,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    maxUses: 1,
    ...over,
  }
}
