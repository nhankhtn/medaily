import { describe, expect, it } from 'vitest'
import { bindableCustomMetrics, type CustomMetricRow } from '../../src/lib/metrics/bindable'

const row = (patch: Partial<CustomMetricRow> = {}): CustomMetricRow => ({
  key: 'guitar_minutes',
  labelEn: 'Guitar',
  labelVi: 'Đàn ghi-ta',
  type: 'duration',
  min: null,
  max: null,
  archivedAt: null,
  ...patch,
})

const keys = (rows: CustomMetricRow[]) =>
  bindableCustomMetrics(rows, 'vi').map((metric) => metric.key)

describe('bindableCustomMetrics', () => {
  it('offers a metric in the language being read', () => {
    expect(bindableCustomMetrics([row()], 'vi')[0]?.label).toBe('Đàn ghi-ta')
    expect(bindableCustomMetrics([row()], 'en')[0]?.label).toBe('Guitar')
  })

  it('falls back to the key when a label was left blank', () => {
    expect(bindableCustomMetrics([row({ labelVi: '   ' })], 'vi')[0]?.label).toBe('guitar_minutes')
  })

  it('leaves out a metric that has no number to compare', () => {
    expect(keys([row({ type: 'text' })])).toEqual([])
  })

  it('leaves out one that is no longer tracked', () => {
    expect(keys([row({ archivedAt: new Date() })])).toEqual([])
  })

  it('opens a duration on half an hour and a yes/no on one', () => {
    expect(bindableCustomMetrics([row({ type: 'duration' })], 'vi')[0]?.suggested).toBe(30)
    expect(bindableCustomMetrics([row({ type: 'boolean' })], 'vi')[0]?.suggested).toBe(1)
  })

  it('opens a scale in the middle of its own range', () => {
    expect(bindableCustomMetrics([row({ type: 'scale' })], 'vi')[0]?.suggested).toBe(6)
    expect(
      bindableCustomMetrics([row({ type: 'scale', min: '0', max: '4' })], 'vi')[0]?.suggested,
    ).toBe(2)
  })

  it('keeps the ones that are usable, in the order given', () => {
    expect(
      keys([row({ key: 'a' }), row({ key: 'b', type: 'text' }), row({ key: 'c', type: 'number' })]),
    ).toEqual(['a', 'c'])
  })
})
