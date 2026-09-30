import { beforeEach, describe, expect, it } from 'vitest'
import { inMemoryChatStore } from '@/lib/chat/store'
import { claimInvitesFor, eraseChat } from '@/server/services/chat'

let store = inMemoryChatStore()
const soon = () => new Date(Date.now() + 3_600_000).toISOString()

async function room(id: string, members: string[]) {
  await store.createRoom({
    id,
    kind: 'group',
    title: id,
    createdBy: members[0] ?? null,
    doorbellKey: `door-${id}`,
    directKey: null,
  })
  for (const userId of members) {
    await store.addMember({
      roomId: id,
      userId,
      role: userId === members[0] ? 'owner' : 'member',
      joinedAt: new Date().toISOString(),
    })
  }
}

/**
 * MongoDB has no cascade. Nothing anywhere makes erasure happen for chat, and
 * nothing would notice if it stopped — no foreign key would complain, no query
 * would break. So this is the test that has to.
 */
describe('erasing somebody from chat', () => {
  beforeEach(() => {
    store = inMemoryChatStore()
  })

  it('takes their name off what they wrote, and leaves the words', async () => {
    await room('r1', ['u1', 'u2'])
    await store.appendMessage({ roomId: 'r1', userId: 'u1', body: 'tôi viết', clientId: 'a' })
    await eraseChat('u1', { store })

    const [left] = (await store.listBackward('r1', { limit: 50 })).items
    expect(left?.userId, 'nothing points back at them').toBeNull()
    expect(left?.body, 'the conversation still reads').toBe('tôi viết')
  })

  it('cannot be found by looking for them afterwards', async () => {
    await room('r1', ['u1', 'u2'])
    await store.appendMessage({ roomId: 'r1', userId: 'u1', body: 'x', clientId: 'a' })
    await eraseChat('u1', { store })

    await store.anonymiseMessagesOf('u1')
    const mine = (await store.listBackward('r1', { limit: 50 })).items.filter(
      (m) => m.userId === 'u1',
    )
    expect(mine).toEqual([])
  })

  it('leaves everybody else alone', async () => {
    await room('r1', ['u1', 'u2'])
    await store.appendMessage({ roomId: 'r1', userId: 'u2', body: 'của tôi', clientId: 'b' })
    await eraseChat('u1', { store })

    expect((await store.listBackward('r1', { limit: 50 })).items[0]?.userId).toBe('u2')
    expect(await store.findRoom('r1'), 'the room survives its creator').toBeTruthy()
    expect(await store.findMember('r1', 'u2')).toBeTruthy()
  })

  it('takes their seat in every room', async () => {
    await room('r1', ['u1', 'u2'])
    await room('r2', ['u2', 'u1'])
    await eraseChat('u1', { store })

    expect(await store.findMember('r1', 'u1')).toBeNull()
    expect(await store.findMember('r2', 'u1')).toBeNull()
  })

  /** Nothing else sweeps these: a room with nobody in it is unreachable. */
  it('takes a room that is now empty, and its messages with it', async () => {
    await room('alone', ['u1'])
    await store.appendMessage({ roomId: 'alone', userId: 'u1', body: 'một mình', clientId: 'c' })
    await eraseChat('u1', { store })

    expect(await store.findRoom('alone')).toBeNull()
    expect((await store.listBackward('alone', { limit: 50 })).items).toEqual([])
  })

  it('takes the invites they had out', async () => {
    await room('r1', ['u1', 'u2'])
    await store.createInvite({
      code: 'theirs',
      roomId: 'r1',
      createdBy: 'u1',
      email: null,
      expiresAt: soon(),
      maxUses: 1,
    })
    await eraseChat('u1', { store })

    expect(await store.findInvite('theirs')).toBeNull()
  })

  /** Erasure has no transaction behind it, so running it twice must be safe. */
  it('can be run again without doing harm', async () => {
    await room('r1', ['u1', 'u2'])
    await store.appendMessage({ roomId: 'r1', userId: 'u1', body: 'x', clientId: 'a' })
    await eraseChat('u1', { store })
    await eraseChat('u1', { store })

    expect((await store.listBackward('r1', { limit: 50 })).items).toHaveLength(1)
  })
})

describe('an invite waiting for somebody who signs in later', () => {
  beforeEach(() => {
    store = inMemoryChatStore()
  })

  it('seats them the first time they arrive', async () => {
    await room('r1', ['u1'])
    await store.createInvite({
      code: 'k',
      roomId: 'r1',
      createdBy: 'u1',
      email: 'ban@example.com',
      expiresAt: soon(),
      maxUses: 1,
    })

    expect(await claimInvitesFor('ban@example.com', 'u2', { store })).toBe(1)
    expect(await store.findMember('r1', 'u2')).toBeTruthy()
  })

  it('is spent, so signing in again does not use it twice', async () => {
    await room('r1', ['u1'])
    await store.createInvite({
      code: 'k',
      roomId: 'r1',
      createdBy: 'u1',
      email: 'ban@example.com',
      expiresAt: soon(),
      maxUses: 1,
    })
    await claimInvitesFor('ban@example.com', 'u2', { store })

    expect(await claimInvitesFor('ban@example.com', 'u2', { store })).toBe(0)
  })

  it('ignores an address nobody invited', async () => {
    expect(await claimInvitesFor('nobody@example.com', 'u2', { store })).toBe(0)
  })

  it('does nothing for somebody signing in without an address', async () => {
    expect(await claimInvitesFor(null, 'u2', { store })).toBe(0)
  })
})
