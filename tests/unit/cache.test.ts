import { afterEach, describe, expect, it, vi } from 'vitest'
import { forget, remember } from '@/server/cache'

afterEach(() => {
  vi.useRealTimers()
})

/** A loader that counts its calls and can be released by hand. */
function counter<T>(value: T) {
  let calls = 0
  return {
    get calls() {
      return calls
    },
    load: async () => {
      calls += 1
      return value
    },
  }
}

describe('remember', () => {
  it('reads once and serves the rest from memory', async () => {
    const source = counter('first')
    const key = `k-${Math.random()}`

    expect(await remember(key, 1000, source.load)).toBe('first')
    expect(await remember(key, 1000, source.load)).toBe('first')
    expect(source.calls).toBe(1)
  })

  it('reads again once the entry is past its time', async () => {
    vi.useFakeTimers()
    const source = counter('value')
    const key = `k-${Math.random()}`

    await remember(key, 1000, source.load)
    vi.advanceTimersByTime(1001)
    await remember(key, 1000, source.load)

    expect(source.calls).toBe(2)
  })

  it('gives concurrent callers one read rather than a race', async () => {
    let calls = 0
    let release: (value: string) => void = () => {}
    const load = () => {
      calls += 1
      return new Promise<string>((resolve) => {
        release = resolve
      })
    }
    const key = `k-${Math.random()}`

    const both = Promise.all([remember(key, 1000, load), remember(key, 1000, load)])
    release('shared')

    expect(await both).toEqual(['shared', 'shared'])
    expect(calls).toBe(1)
  })

  it('does not keep a read that failed', async () => {
    const key = `k-${Math.random()}`
    let attempt = 0
    const load = async () => {
      attempt += 1
      if (attempt === 1) throw new Error('database is away')
      return 'second try'
    }

    await expect(remember(key, 1000, load)).rejects.toThrow('database is away')
    expect(await remember(key, 1000, load)).toBe('second try')
  })
})

describe('forget', () => {
  it('sends the next caller back to the source', async () => {
    const key = `k-${Math.random()}`
    let value = 'before'

    expect(await remember(key, 1000, async () => value)).toBe('before')
    value = 'after'
    expect(await remember(key, 1000, async () => value)).toBe('before')

    forget(key)
    expect(await remember(key, 1000, async () => value)).toBe('after')
  })

  it('discards a read that was already in flight when the write landed', async () => {
    const key = `k-${Math.random()}`
    let release: (value: string) => void = () => {}
    const slow = () =>
      new Promise<string>((resolve) => {
        release = resolve
      })

    // A read starts, a write lands, and only then does the read come back
    // carrying the row as it was before that write.
    const inFlight = remember(key, 1000, slow)
    forget(key)
    release('stale')
    expect(await inFlight).toBe('stale')

    // The stale value must not have been left behind for the next caller.
    expect(await remember(key, 1000, async () => 'fresh')).toBe('fresh')
  })
})
