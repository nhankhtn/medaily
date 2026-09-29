import { describe, expect, it } from 'vitest'
import { EVERY_ACTIVITY_ACTION, isActivityAction, type ActivityAction } from '@/lib/activity/types'
import en from '../../messages/en.json'
import vi from '../../messages/vi.json'

/**
 * The vocabulary is closed on purpose: a log the UI cannot label is a log
 * nobody reads. These check the two ways that breaks — a name the app writes
 * and cannot translate, and a name a stored row carries that the app no longer
 * knows.
 */
describe('the activity vocabulary', () => {
  const every = EVERY_ACTIVITY_ACTION

  /**
   * Nested, not dotted. `next-intl` reads `.` as nesting and refuses a key
   * that contains one — from the root layout, which takes every page down
   * with it, not just the one that would have shown the label. The first
   * version of this test read the JSON directly and so proved nothing about
   * the library that actually consumes it.
   */
  const labelOf = (messages: typeof en, action: ActivityAction): unknown => {
    const [entity, verb] = action.split('.')
    const actions = messages.activity.actions as Record<string, Record<string, string>>
    return actions[entity ?? '']?.[verb ?? '']
  }

  it('has a label in both locales for every action it can write', () => {
    for (const action of every) {
      expect(labelOf(en, action), `en: ${action}`).toBeTruthy()
      expect(labelOf(vi, action), `vi: ${action}`).toBeTruthy()
    }
  })

  it('accepts every action it can write', () => {
    for (const action of every) expect(isActivityAction(action), action).toBe(true)
  })

  /**
   * Rows outlive deploys. One written by a build that knew `invoice.void` must
   * be skipped rather than printed as a raw key at whoever opens Settings.
   */
  it.each([
    ['invoice.void'],
    ['transaction'],
    ['transaction.'],
    ['transaction.delete.extra'],
    ['transaction.archive'],
    ['transaction.login'],
    ['session.delete'],
    [''],
  ])('refuses %j, which no build of this app writes', (value) => {
    expect(isActivityAction(value)).toBe(false)
  })

  it.each([[null], [undefined], [42], [{}]])('refuses the non-string %j', (value) => {
    expect(isActivityAction(value)).toBe(false)
  })
})

/**
 * The failure this catches took the whole app down: a message key holding a
 * `.` is read by `next-intl` as nesting, and the error is thrown from the root
 * layout rather than from the screen that uses it. `tsc` cannot see it and a
 * test that reads the JSON by hand walks straight past it — so the guard has
 * to be about the shape of the file itself.
 */
describe('the message files', () => {
  const dotted = (messages: unknown, path: string[] = []): string[] => {
    if (typeof messages !== 'object' || messages === null) return []
    return Object.entries(messages).flatMap(([key, value]) => [
      ...(key.includes('.') ? [[...path, key].join(' → ')] : []),
      ...dotted(value, [...path, key]),
    ])
  }

  it.each([
    ['en', en],
    ['vi', vi],
  ])('has no key in %s containing a dot', (_locale, messages) => {
    expect(dotted(messages)).toEqual([])
  })
})
