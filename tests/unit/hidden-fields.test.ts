import { describe, expect, it } from 'vitest'
import { EMPTY_VALUES } from '@/features/daily/types'
import {
  fieldIsHidden,
  HIDEABLE_FIELDS,
  METRIC_OF,
  parseHiddenFields,
  TIMER_FILLS,
  visibleFields,
} from '@/lib/daily/hidden-fields'
import { METRIC_KEYS } from '@/lib/types'

describe('what the day log stops asking', () => {
  it('drops a field that is off and empty', () => {
    expect(fieldIsHidden('mood', ['mood'], EMPTY_VALUES)).toBe(true)
    expect(visibleFields(['energy', 'mood'], ['mood'], EMPTY_VALUES)).toEqual(['energy'])
  })

  /**
   * The timer fills six of these without anyone typing. A number you cannot
   * see is a number you cannot correct, so a value on the day outranks the
   * setting — hiding means "stop asking", not "hide what is already there".
   */
  it('keeps a field that is off but has something in it', () => {
    const values = { ...EMPTY_VALUES, readingMinutes: 30 }
    expect(fieldIsHidden('readingMinutes', ['readingMinutes'], values)).toBe(false)
    expect(visibleFields(['readingMinutes'], ['readingMinutes'], values)).toEqual([
      'readingMinutes',
    ])
  })

  it('counts a zero as something written, not as empty', () => {
    const values = { ...EMPTY_VALUES, entertainmentMinutes: 0 }
    expect(fieldIsHidden('entertainmentMinutes', ['entertainmentMinutes'], values)).toBe(false)
  })

  it('leaves a field alone when nothing is off', () => {
    expect(visibleFields(HIDEABLE_FIELDS, [], EMPTY_VALUES)).toEqual([...HIDEABLE_FIELDS])
  })
})

describe('reading the stored list back', () => {
  it('keeps only fields that still exist', () => {
    expect(parseHiddenFields(['mood', 'a_field_we_removed', 'energy'])).toEqual(['mood', 'energy'])
  })

  it('survives anything that is not a list of strings', () => {
    expect(parseHiddenFields(null)).toEqual([])
    expect(parseHiddenFields('mood')).toEqual([])
    expect(parseHiddenFields([1, {}, null])).toEqual([])
  })

  it('does not store the same field twice', () => {
    expect(parseHiddenFields(['mood', 'mood'])).toEqual(['mood'])
  })
})

describe('what a field feeds', () => {
  /**
   * The panel warns before a field is switched off by looking its metric up
   * here. A typo in a key would mean no warning and a habit that silently
   * stops ticking, so every one of them has to be a real metric.
   */
  it('names a real metric for every field that has one', () => {
    for (const [field, key] of Object.entries(METRIC_OF)) {
      expect(METRIC_KEYS, field).toContain(key)
    }
  })

  it('only claims fields that the form actually offers', () => {
    for (const field of [...Object.keys(METRIC_OF), ...TIMER_FILLS]) {
      expect(HIDEABLE_FIELDS, field).toContain(field)
    }
  })
})
