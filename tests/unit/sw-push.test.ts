import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

/**
 * What a notification actually says.
 *
 * `public/sw.js` is plain JS served straight out of the directory, with no
 * build and nothing importing it — so nothing here could ever have noticed
 * that every notification was coming out as the app's name over an empty
 * line. It did that for a reason no amount of reading the sender would show:
 * FCM wraps `message.data` in an envelope before the raw Push API sees it, and
 * the fields were being read off the top level.
 *
 * So the worker is loaded into a sandbox and its push handler is called the
 * way a browser calls it. This is the only test that can tell the difference
 * between a notification and a blank one.
 */
function pushHandler(): (event: unknown) => void {
  const handlers = new Map<string, (event: unknown) => void>()
  const sandbox = {
    self: {
      addEventListener: (type: string, handler: (event: unknown) => void) =>
        handlers.set(type, handler),
      registration: { showNotification: async () => {} },
      clients: { claim: async () => {}, matchAll: async () => [], openWindow: async () => {} },
      skipWaiting: () => {},
      location: { origin: 'https://example.test' },
    },
    caches: { open: async () => ({}), keys: async () => [], delete: async () => true },
    fetch: async () => ({}),
    URL,
    Response,
    Request,
    console,
  }

  runInContext(readFileSync('public/sw.js', 'utf8'), createContext(sandbox))
  const handler = handlers.get('push')
  if (!handler) throw new Error('public/sw.js registered no push handler')
  return handler
}

/** Calls the handler the way a browser does, and reports what was drawn. */
async function shown(payload: unknown): Promise<{ title: string; options: Record<string, unknown> }> {
  const drawn: { title: string; options: Record<string, unknown> }[] = []
  const handlers = new Map<string, (event: unknown) => void>()
  const sandbox = {
    self: {
      addEventListener: (type: string, handler: (event: unknown) => void) =>
        handlers.set(type, handler),
      registration: {
        showNotification: async (title: string, options: Record<string, unknown>) => {
          drawn.push({ title, options })
        },
      },
      clients: { claim: async () => {}, matchAll: async () => [], openWindow: async () => {} },
      skipWaiting: () => {},
      location: { origin: 'https://example.test' },
    },
    caches: { open: async () => ({}), keys: async () => [], delete: async () => true },
    fetch: async () => ({}),
    URL,
    Response,
    Request,
    console,
  }
  runInContext(readFileSync('public/sw.js', 'utf8'), createContext(sandbox))

  let waited: Promise<unknown> = Promise.resolve()
  handlers.get('push')!({
    data: payload === undefined ? null : { json: () => payload },
    waitUntil: (promise: Promise<unknown>) => (waited = promise),
  })
  await waited

  if (drawn.length !== 1) {
    // Never zero: a browser that is sent pushes and shown nothing takes the
    // permission back, on iOS quickly.
    throw new Error(`expected exactly one notification, got ${drawn.length}`)
  }
  return drawn[0]!
}

const SENT = { title: 'Phòng thử', body: 'Nhân: chào bạn', url: '/chat/abc', tag: 'chat:abc' }

describe('the push handler', () => {
  it('registers itself, so a push is not simply dropped', () => {
    expect(pushHandler()).toBeTypeOf('function')
  })

  it('reads a payload inside the envelope FCM wraps it in', async () => {
    // The shape that actually arrives: `message.data` nested under `data`,
    // beside FCM's own fields. Read flat, every one of these was undefined.
    const { title, options } = await shown({
      data: SENT,
      from: '845482919969',
      fcmMessageId: 'a-message-id',
    })

    expect(title).toBe('Phòng thử')
    expect(options.body).toBe('Nhân: chào bạn')
  })

  it('carries the room through, so the tap lands in the conversation', async () => {
    const { options } = await shown({ data: SENT, from: '845482919969' })
    expect(options.data).toEqual({ url: '/chat/abc' })
    // One room is one line on the lock screen, however many messages arrive.
    expect(options.tag).toBe('chat:abc')
  })

  it('still reads a payload that was never wrapped', async () => {
    const { title, options } = await shown(SENT)
    expect(title).toBe('Phòng thử')
    expect(options.body).toBe('Nhân: chào bạn')
  })

  it('draws something for a payload it cannot make sense of', async () => {
    const { title, options } = await shown({ from: '845482919969' })
    expect(title).toBe('medaily')
    expect(options.body).toBe('')
  })

  it('draws something for a push carrying nothing at all', async () => {
    const { title } = await shown(undefined)
    expect(title).toBe('medaily')
  })

  it('refuses a url that would leave the app', async () => {
    // The url is written into the notification and followed on a tap, so an
    // absolute one would make a push a way to open any page in this browser.
    const { options } = await shown({ data: { ...SENT, url: 'https://evil.test/take-me' } })
    expect(options.data).toEqual({ url: '/' })
  })
})
