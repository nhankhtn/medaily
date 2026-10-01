import { beforeEach, describe, expect, it } from 'vitest'
import { inMemoryChatStore } from '@/lib/chat/store'
import {
  assertCanInvite,
  assertMember,
  isMember,
  NotAMemberError,
  sweepIfEmpty,
} from '@/server/services/chat'

let store = inMemoryChatStore()

async function room(id: string, members: [string, 'owner' | 'member'][]) {
  await store.createRoom({
    id,
    kind: 'group',
    title: 'Phòng',
    createdBy: members[0]?.[0] ?? null,
    doorbellKey: `door-${id}`,
    directKey: null,
  })
  for (const [userId, role] of members) {
    await store.addMember({ roomId: id, userId, role, joinedAt: new Date().toISOString() })
  }
}

/**
 * Everywhere else in this app a row is yours because the query said
 * `WHERE user_id = $1`. A room belongs to several people, so that sentence has
 * nowhere to go and `assertMember` stands in its place. It is the only thing
 * between one person's conversation and everybody else, which is why it gets
 * its own file.
 */
describe('who may read a room', () => {
  beforeEach(() => {
    store = inMemoryChatStore()
  })

  it('lets a member in', async () => {
    await room('r1', [['u1', 'owner']])
    await expect(assertMember('r1', 'u1', { store })).resolves.toMatchObject({ role: 'owner' })
  })

  it('refuses somebody who was never in the room', async () => {
    await room('r1', [['u1', 'owner']])
    await expect(assertMember('r1', 'stranger', { store })).rejects.toThrow(NotAMemberError)
  })

  /** The one a naive `findMember` check gets wrong. */
  it('refuses somebody who has left', async () => {
    await room('r1', [
      ['u1', 'owner'],
      ['u2', 'member'],
    ])
    await store.removeMember('r1', 'u2')

    await expect(assertMember('r1', 'u2', { store })).rejects.toThrow(NotAMemberError)
  })

  /** Being in *a* room is not being in *this* room. */
  it('refuses a member of a different room', async () => {
    await room('r1', [['u1', 'owner']])
    await room('r2', [['u2', 'owner']])

    await expect(assertMember('r1', 'u2', { store })).rejects.toThrow(NotAMemberError)
  })

  it('refuses a room that does not exist', async () => {
    await expect(assertMember('nope', 'u1', { store })).rejects.toThrow(NotAMemberError)
  })

  it('answers the same question without throwing, for callers that want a fact', async () => {
    await room('r1', [['u1', 'owner']])

    expect(await isMember('r1', 'u1', { store })).toBe(true)
    expect(await isMember('r1', 'stranger', { store })).toBe(false)
  })
})

describe('who may invite', () => {
  beforeEach(() => {
    store = inMemoryChatStore()
  })

  it('lets the person who made the room invite', async () => {
    await room('r1', [['u1', 'owner']])
    await expect(assertCanInvite('r1', 'u1', { store })).resolves.toBeUndefined()
  })

  it('refuses an ordinary member', async () => {
    await room('r1', [
      ['u1', 'owner'],
      ['u2', 'member'],
    ])
    await expect(assertCanInvite('r1', 'u2', { store })).rejects.toThrow(NotAMemberError)
  })

  it('refuses a stranger before it even looks at the role', async () => {
    await room('r1', [['u1', 'owner']])
    await expect(assertCanInvite('r1', 'stranger', { store })).rejects.toThrow(NotAMemberError)
  })
})

describe('sweeping an empty room', () => {
  beforeEach(() => {
    store = inMemoryChatStore()
  })

  /** Nothing else does this: MongoDB has no cascade to lean on. */
  it('takes the room and its messages once the last person goes', async () => {
    await room('r1', [['u1', 'owner']])
    await store.appendMessage({
      roomId: 'r1',
      userId: 'u1',
      kind: 'text',
      body: 'bye',
      clientId: 'c1',
    })
    await store.removeMember('r1', 'u1')

    expect(await sweepIfEmpty('r1', { store })).toBe(true)
    expect(await store.findRoom('r1')).toBeNull()
    expect((await store.listBackward('r1', { limit: 50 })).items).toEqual([])
  })

  it('leaves a room alone while anybody is still in it', async () => {
    await room('r1', [
      ['u1', 'owner'],
      ['u2', 'member'],
    ])
    await store.removeMember('r1', 'u1')

    expect(await sweepIfEmpty('r1', { store })).toBe(false)
    expect(await store.findRoom('r1')).toBeTruthy()
  })
})
