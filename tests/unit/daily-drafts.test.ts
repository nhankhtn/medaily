import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearDailyDrafts, DRAFT_PREFIX, isDraftKey } from '@/features/daily/use-draft'

/**
 * A draft is the daily log someone typed and did not save — their words, in
 * this browser. Left behind by a sign-out, the next person to open the same
 * date gets it restored into their own form: the restore only asks whether
 * the draft differs from the server's values, and cannot know whose it was.
 *
 * The tests run against a stand-in for `localStorage` rather than a browser,
 * which is enough because what can go wrong here is the sweep, not the API.
 */
function fakeStorage(entries: Record<string, string> = {}) {
  const map = new Map(Object.entries(entries))
  return {
    get length() {
      return map.size
    },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
    keys: () => [...map.keys()],
  }
}

function install(storage: ReturnType<typeof fakeStorage>) {
  vi.stubGlobal('localStorage', storage)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('isDraftKey', () => {
  it('claims the app’s own drafts and nothing else', () => {
    expect(isDraftKey(`${DRAFT_PREFIX}2026-09-18`)).toBe(true)
    expect(isDraftKey('medaily.sidebar.collapsed')).toBe(false)
    expect(isDraftKey('something-else')).toBe(false)
    expect(isDraftKey('')).toBe(false)
  })
})

describe('clearDailyDrafts', () => {
  /**
   * The one that matters. Removing during an index walk shifts every later key
   * down one and the walk steps over half of them — which would leave a
   * person's words behind on exactly the sign-out meant to remove them.
   */
  it('removes every draft, not every other one', () => {
    const storage = fakeStorage(
      Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [`${DRAFT_PREFIX}2026-09-0${i + 1}`, '{}']),
      ),
    )
    install(storage)

    clearDailyDrafts()

    expect(storage.keys()).toEqual([])
  })

  it('leaves settings and anything else alone', () => {
    const storage = fakeStorage({
      [`${DRAFT_PREFIX}2026-09-18`]: '{}',
      'medaily.sidebar.collapsed': '1',
      'some.other.app': 'x',
    })
    install(storage)

    clearDailyDrafts()

    expect(storage.keys()).toEqual(['medaily.sidebar.collapsed', 'some.other.app'])
  })

  it('does nothing when there is nothing kept', () => {
    const storage = fakeStorage()
    install(storage)

    expect(() => clearDailyDrafts()).not.toThrow()
    expect(storage.keys()).toEqual([])
  })

  /** Private mode, or storage blocked. Signing out must not depend on it. */
  it('does not throw when storage itself is unavailable', () => {
    vi.stubGlobal('localStorage', {
      get length(): number {
        throw new Error('blocked')
      },
    })

    expect(() => clearDailyDrafts()).not.toThrow()
  })
})
