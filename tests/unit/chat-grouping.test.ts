import { describe, expect, it } from 'vitest'
import { dayKeyOf, layoutAt, RUN_GAP_MS, type Groupable } from '@/lib/chat/grouping'

/**
 * What turns a log into a conversation. The name is drawn from `startsRun` and
 * the avatar from `endsRun`, so getting either backwards puts a face beside the
 * wrong line or repeats one name down the whole screen.
 */
const at = (userId: string | null, iso: string): Groupable => ({ userId, createdAt: iso })
const NOW = Date.parse('2026-09-30T10:00:00+07:00')
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()

describe('layoutAt', () => {
  it('makes a lone message its own run', () => {
    expect(layoutAt([at('a', iso(0))], 0, NOW)).toEqual({
      startsRun: true,
      endsRun: true,
      startsDay: false,
    })
  })

  it('runs two quick messages from one person together', () => {
    const messages = [at('a', iso(0)), at('a', iso(1_000))]
    expect(layoutAt(messages, 0, NOW).endsRun).toBe(false)
    expect(layoutAt(messages, 1, NOW).startsRun).toBe(false)
    // The name goes on the first, the face on the last.
    expect(layoutAt(messages, 0, NOW).startsRun).toBe(true)
    expect(layoutAt(messages, 1, NOW).endsRun).toBe(true)
  })

  it('breaks the run when somebody else speaks', () => {
    const messages = [at('a', iso(0)), at('b', iso(1_000))]
    expect(layoutAt(messages, 0, NOW).endsRun).toBe(true)
    expect(layoutAt(messages, 1, NOW).startsRun).toBe(true)
  })

  /**
   * Longer and a conversation picked up after lunch runs into the morning's;
   * shorter and somebody typing slowly gets their name repeated mid-sentence.
   */
  it('breaks the run after a long enough silence', () => {
    const messages = [at('a', iso(0)), at('a', iso(RUN_GAP_MS))]
    expect(layoutAt(messages, 1, NOW).startsRun).toBe(true)
  })

  it('keeps the run just inside the silence', () => {
    const messages = [at('a', iso(0)), at('a', iso(RUN_GAP_MS - 1))]
    expect(layoutAt(messages, 1, NOW).startsRun).toBe(false)
  })

  /**
   * Two messages four minutes apart across midnight get a date line between
   * them on screen. A run that continued across it would strand its name above
   * the line, above somebody else's day.
   */
  it('breaks the run at a day boundary however short the gap', () => {
    const messages = [
      at('a', '2026-09-30T23:59:00+07:00'),
      at('a', '2026-10-01T00:01:00+07:00'),
    ]
    expect(layoutAt(messages, 1, NOW).startsRun).toBe(true)
    expect(layoutAt(messages, 1, NOW).startsDay).toBe(true)
  })

  /**
   * There is nothing above the first message for a date to separate it from,
   * and a label alone at the top reads as a heading nobody asked for.
   */
  it('draws no separator above the very first message', () => {
    expect(layoutAt([at('a', iso(0))], 0, NOW).startsDay).toBe(false)
  })

  /**
   * A message with no timestamp has not been acknowledged yet and was typed
   * just now, so it belongs to the run above rather than starting one.
   */
  it('joins a message still on its way to the run above it', () => {
    const messages = [at('a', iso(-1_000)), at('a', '')]
    expect(layoutAt(messages, 1, NOW).startsRun).toBe(false)
  })

  it('survives an index that is not there', () => {
    expect(layoutAt([], 0, NOW)).toEqual({ startsRun: true, endsRun: true, startsDay: false })
  })
})

describe('dayKeyOf', () => {
  it('reads a timestamp the app cannot parse as now, rather than as 1970', () => {
    expect(dayKeyOf(at('a', 'not a date'), NOW)).toBe(dayKeyOf(at('a', ''), NOW))
  })
})
