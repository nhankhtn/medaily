/**
 * A doorbell, not a database.
 *
 * Something rang: go and ask the server what changed. The signal never carries
 * what changed, and it deliberately knows nothing about chat — `channel` is an
 * opaque key, so whoever loses access to a room loses the ability to hear it
 * by having the key rotated out from under them.
 *
 * A ring is **edge-triggered**. Nothing compares what the channel holds against
 * what it held before: a payload is attacker-writable, and a client that gated
 * on a counter could be deafened for good by one absurdly large number. The
 * only thing a ring means is "ask".
 */
export type RealtimeSignal = {
  /** Short name, for logs and for saying which one is in use. */
  id: string
  ring: (channel: string) => Promise<void>
  /** Returns how to stop listening. */
  listen: (channel: string, onRing: () => void) => () => void
}

/**
 * Used where no transport is configured. Nothing rings and nothing listens, so
 * the screen falls back to asking on a slow timer — late, never broken.
 */
export const NO_REALTIME: RealtimeSignal = {
  id: 'none',
  ring: async () => {},
  listen: () => () => {},
}

/** For tests: rings are delivered synchronously to whoever is listening. */
export function inMemorySignal(): RealtimeSignal & { listeners: (channel: string) => number } {
  const channels = new Map<string, Set<() => void>>()

  return {
    id: 'memory',
    ring: async (channel) => {
      for (const listener of channels.get(channel) ?? []) listener()
    },
    listen: (channel, onRing) => {
      const listeners = channels.get(channel) ?? new Set()
      listeners.add(onRing)
      channels.set(channel, listeners)
      return () => listeners.delete(onRing)
    },
    listeners: (channel) => channels.get(channel)?.size ?? 0,
  }
}
