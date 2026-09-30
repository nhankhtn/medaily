import type { TypingEntry } from './typing'

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

/**
 * The other half of the transport: a claim that can be read, not just heard.
 *
 * Kept as its own type rather than grown onto `RealtimeSignal`, because the
 * doorbell's whole guarantee is that nobody reads what it carries. Something
 * that must be read belongs beside it, where the difference is stated, not
 * inside it, where the difference would quietly stop being true.
 */
export type TypingChannel = {
  id: string
  /** Says "still me, still typing" in the caller's own name. */
  announce: (channel: string) => Promise<void>
  /**
   * Takes the claim back now, rather than letting it time out.
   *
   * Sending a message is the case that needs it: the message lands on the
   * other screen instantly, and a name still marked as typing beside it for
   * the rest of the TTL reads as the app being confused.
   */
  retract: (channel: string) => Promise<void>
  /** Returns how to stop watching. */
  watch: (channel: string, onChange: (entries: TypingEntry[]) => void) => () => void
}

/** Used where no transport is configured: nobody ever appears to be typing. */
export const NO_TYPING: TypingChannel = {
  id: 'none',
  announce: async () => {},
  retract: async () => {},
  watch: () => () => {},
}

/** For tests: claims are delivered synchronously, under the given identity. */
export function inMemoryTyping(me: string): TypingChannel & { now: () => number } {
  const channels = new Map<string, Map<string, number>>()
  const watchers = new Map<string, Set<(entries: TypingEntry[]) => void>>()
  let clock = 0

  const emit = (channel: string) => {
    const entries = [...(channels.get(channel) ?? new Map())].map(([uid, at]) => ({ uid, at }))
    for (const watcher of watchers.get(channel) ?? []) watcher(entries)
  }

  return {
    id: 'memory',
    now: () => clock,
    announce: async (channel) => {
      const claims = channels.get(channel) ?? new Map<string, number>()
      claims.set(me, (clock += 1))
      channels.set(channel, claims)
      emit(channel)
    },
    retract: async (channel) => {
      channels.get(channel)?.delete(me)
      emit(channel)
    },
    watch: (channel, onChange) => {
      const set = watchers.get(channel) ?? new Set()
      set.add(onChange)
      watchers.set(channel, set)
      return () => set.delete(onChange)
    },
  }
}
