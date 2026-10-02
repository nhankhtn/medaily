import { beforeEach, describe, expect, it } from 'vitest'
import { inMemoryChatStore } from '@/lib/chat/store'
import { NotAMemberError, searchRoom } from '@/server/services/chat'

/**
 * Searching a room whose words are sealed.
 *
 * There is no index to lean on, so this reads pages and compares in memory —
 * which makes the bounds part of the behaviour rather than an implementation
 * note. A scan that forgot to stop would hold a request open over a room
 * somebody had been using for a year.
 */
let store = inMemoryChatStore()

async function room(id: string, members: string[]) {
  await store.createRoom({
    id,
    kind: 'group',
    title: 'Phòng',
    createdBy: members[0] ?? null,
    doorbellKey: `door-${id}`,
    directKey: null,
  })
  for (const userId of members) {
    await store.addMember({ roomId: id, userId, role: 'member', joinedAt: new Date().toISOString() })
  }
}

async function say(roomId: string, userId: string, body: string, clientId: string) {
  return store.appendMessage({ roomId, userId, kind: 'text', body, clientId, replyToId: null })
}

beforeEach(() => {
  store = inMemoryChatStore()
})

describe('searchRoom', () => {
  it('finds a line by a word typed without its marks', async () => {
    await room('r1', ['u1'])
    await say('r1', 'u1', 'mai họp 9h nhé', 'c1')
    await say('r1', 'u1', 'chiều đi ăn', 'c2')

    const found = await searchRoom({ roomId: 'r1', userId: 'u1', query: 'hop' }, { store })
    expect(found.items.map((m) => m.body)).toEqual(['mai họp 9h nhé'])
  })

  it('hands back the newest match first, which is the one being looked for', async () => {
    await room('r1', ['u1'])
    await say('r1', 'u1', 'họp lần một', 'c1')
    await say('r1', 'u1', 'họp lần hai', 'c2')

    const found = await searchRoom({ roomId: 'r1', userId: 'u1', query: 'họp' }, { store })
    expect(found.items.map((m) => m.body)).toEqual(['họp lần hai', 'họp lần một'])
  })

  it('leaves out a message that was recalled, which has no words left', async () => {
    await room('r1', ['u1'])
    const gone = await say('r1', 'u1', 'họp bí mật', 'c1')
    await store.softDeleteMessage('r1', gone.id, 'u1')

    expect((await searchRoom({ roomId: 'r1', userId: 'u1', query: 'hop' }, { store })).items).toEqual(
      [],
    )
  })

  it('leaves out a sticker, whose body is an id nobody typed', async () => {
    await room('r1', ['u1'])
    await store.appendMessage({
      roomId: 'r1',
      userId: 'u1',
      kind: 'sticker',
      body: 'coffee',
      clientId: 'c1',
      replyToId: null,
    })

    expect(
      (await searchRoom({ roomId: 'r1', userId: 'u1', query: 'coffee' }, { store })).items,
    ).toEqual([])
  })

  it('answers nothing to an empty box rather than everything', async () => {
    await room('r1', ['u1'])
    await say('r1', 'u1', 'bất cứ gì', 'c1')

    const found = await searchRoom({ roomId: 'r1', userId: 'u1', query: '  ' }, { store })
    expect(found.items).toEqual([])
    expect(found.more).toBe(false)
  })

  it('stops at a screenful and says there is more', async () => {
    await room('r1', ['u1'])
    for (let i = 0; i < 30; i++) await say('r1', 'u1', `họp ${i}`, `c${i}`)

    const found = await searchRoom({ roomId: 'r1', userId: 'u1', query: 'hop' }, { store })
    expect(found.items).toHaveLength(20)
    expect(found.cursor).not.toBeNull()
  })

  it('picks up where the last scan stopped, without reading it twice', async () => {
    await room('r1', ['u1'])
    for (let i = 0; i < 30; i++) await say('r1', 'u1', `họp ${i}`, `c${i}`)

    const first = await searchRoom({ roomId: 'r1', userId: 'u1', query: 'hop' }, { store })
    const next = await searchRoom(
      { roomId: 'r1', userId: 'u1', query: 'hop', before: first.cursor },
      { store },
    )

    const ids = new Set(first.items.map((m) => m.id))
    expect(next.items.some((m) => ids.has(m.id))).toBe(false)
    expect(first.items.length + next.items.length).toBe(30)
  })

  it('refuses somebody who is not in the room', async () => {
    await room('r1', ['u1'])
    await say('r1', 'u1', 'họp', 'c1')

    // The same guard every other read has. A search that answered first and
    // checked afterwards would be a way to read a room by guessing at it.
    await expect(searchRoom({ roomId: 'r1', userId: 'u2', query: 'hop' }, { store })).rejects.toThrow(
      NotAMemberError,
    )
  })
})
