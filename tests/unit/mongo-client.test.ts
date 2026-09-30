import { beforeEach, describe, expect, it, vi } from 'vitest'

const createIndexes = vi.fn()
const collection = vi.fn(() => ({ createIndexes }))

vi.mock('mongodb', () => ({
  MongoClient: class {
    db() {
      return { collection }
    }
  },
}))

const logError = vi.fn()
vi.mock('@/lib/log', () => ({ log: { error: (...args: unknown[]) => logError(...args) } }))

const { readyCollection } = await import('@/lib/mongo/client')

const URI = 'mongodb://127.0.0.1:27017/test'
const INDEX = [{ key: { a: 1 }, name: 'a' }]

/**
 * This file exists because of a bug that would not have shown itself.
 *
 * The bootstrap used to memoise on a single global promise keyed by nothing.
 * With one collection that was correct. With two it is silently wrong: the
 * first collection installs its indexes and every other one skips its own, so
 * a query that was fast in development does a full scan in production and
 * nothing anywhere says so.
 */
describe('bootstrapping a collection', () => {
  beforeEach(() => {
    globalThis.__medailyMongo = undefined
    globalThis.__medailyMongoIndexes = undefined
    createIndexes.mockReset().mockResolvedValue(undefined)
    collection.mockClear()
    logError.mockReset()
  })

  it('builds each collection its own indexes', async () => {
    await readyCollection(URI, 'activity', [{ key: { userId: 1 }, name: 'user' }])
    await readyCollection(URI, 'chat_messages', [{ key: { roomId: 1 }, name: 'room' }])

    expect(createIndexes).toHaveBeenCalledTimes(2)
    expect(createIndexes.mock.calls.map(([specs]) => specs[0].name)).toEqual(['user', 'room'])
  })

  /** The TTL on the trail must not follow chat around. */
  it('never hands one collection another collection specs', async () => {
    await readyCollection(URI, 'activity', [{ key: { at: 1 }, name: 'ttl', expireAfterSeconds: 1 }])
    await readyCollection(URI, 'chat_messages', [{ key: { roomId: 1 }, name: 'room' }])

    const [, chat] = createIndexes.mock.calls
    expect(chat?.[0]).toEqual([{ key: { roomId: 1 }, name: 'room' }])
  })

  it('bootstraps a given collection only once per process', async () => {
    await readyCollection(URI, 'activity', INDEX)
    await readyCollection(URI, 'activity', INDEX)

    expect(createIndexes).toHaveBeenCalledTimes(1)
  })

  it('reuses one client across collections', async () => {
    await readyCollection(URI, 'activity', INDEX)
    const first = globalThis.__medailyMongo
    await readyCollection(URI, 'chat_messages', INDEX)

    expect(globalThis.__medailyMongo).toBe(first)
  })

  /**
   * What actually broke a dev server: the global used to hold a single
   * promise, this holds a map, and a hot reload keeps globals across the
   * change. `??=` leaves a promise where a map was expected, and the next
   * line asks it for `.has`.
   */
  it('survives a global left behind by an older build', async () => {
    ;(globalThis as { __medailyMongoIndexes?: unknown }).__medailyMongoIndexes = Promise.resolve()

    await expect(readyCollection(URI, 'activity', INDEX)).resolves.toBeTruthy()
    expect(createIndexes).toHaveBeenCalledTimes(1)
  })

  /**
   * A missing index makes a query slow, not wrong. Refusing to serve would
   * turn a performance problem into an outage.
   */
  it('still hands back the collection when the indexes could not be built', async () => {
    createIndexes.mockRejectedValueOnce(new Error('no permission'))

    await expect(readyCollection(URI, 'activity', INDEX)).resolves.toBeTruthy()
    expect(logError).toHaveBeenCalled()
  })

  it('tries again on the next call after a failure', async () => {
    createIndexes.mockRejectedValueOnce(new Error('transient'))
    await readyCollection(URI, 'activity', INDEX)
    await readyCollection(URI, 'activity', INDEX)

    expect(createIndexes).toHaveBeenCalledTimes(2)
  })

  /**
   * The two memos are independent in both directions: a collection that failed
   * retries, and a collection that succeeded beside it does not start over.
   */
  it('keeps one collection failure out of another collection memo', async () => {
    createIndexes.mockRejectedValueOnce(new Error('transient'))
    await readyCollection(URI, 'activity', INDEX)
    await readyCollection(URI, 'chat_messages', INDEX)
    createIndexes.mockClear()

    await readyCollection(URI, 'chat_messages', INDEX)
    expect(createIndexes, 'chat succeeded, so it is done').not.toHaveBeenCalled()

    await readyCollection(URI, 'activity', INDEX)
    expect(createIndexes, 'activity failed, so it tries again').toHaveBeenCalledTimes(1)
  })
})
