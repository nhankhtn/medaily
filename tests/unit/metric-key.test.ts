import { describe, expect, it } from 'vitest'
import { metricKeyFrom } from '@/lib/metrics/key'

describe('proposing a key from a name', () => {
  it('lowercases and joins words with an underscore', () => {
    expect(metricKeyFrom('Water intake')).toBe('water_intake')
  })

  it('strips Vietnamese tone marks rather than dropping the word', () => {
    expect(metricKeyFrom('Thiền định')).toBe('thien_dinh')
    expect(metricKeyFrom('Đọc sách')).toBe('doc_sach')
  })

  it('drops punctuation instead of encoding it', () => {
    expect(metricKeyFrom('Push-ups (reps)')).toBe('push_ups_reps')
    expect(metricKeyFrom('  Steps  ')).toBe('steps')
  })

  it('never starts with a digit, which the key rule forbids', () => {
    expect(metricKeyFrom('5k run')).toBe('m_5k_run')
  })

  it('gives nothing back for a name with no letters to use', () => {
    expect(metricKeyFrom('  ')).toBe('')
    expect(metricKeyFrom('!!!')).toBe('')
  })

  it('stays inside the length the action accepts', () => {
    expect(metricKeyFrom('a'.repeat(80)).length).toBeLessThanOrEqual(40)
  })
})
