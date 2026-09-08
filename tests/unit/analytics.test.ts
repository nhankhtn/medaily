import { describe, expect, it } from 'vitest'
import { compareBuckets } from '@/lib/analytics/correlation'
import { mean, median, movingAverage, pearson, strengthOf, terciles } from '@/lib/analytics/stats'

describe('stats', () => {
  it('ignores gaps in a moving average instead of reading them as zero', () => {
    const result = movingAverage([10, null, 20, null, null], 3)
    expect(result[0]).toBe(10)
    expect(result[1]).toBe(10)
    expect(result[2]).toBe(15)
    expect(result[3]).toBe(20)
    expect(result[4]).toBe(20)
  })

  it('returns null for empty inputs rather than 0', () => {
    expect(mean([])).toBeNull()
    expect(median([])).toBeNull()
    expect(movingAverage([null, null], 2)).toEqual([null, null])
  })

  it('computes pearson r and labels its strength', () => {
    const perfect = [1, 2, 3, 4, 5].map((n) => ({ x: n, y: 2 * n }))
    expect(pearson(perfect)).toBeCloseTo(1, 5)
    const inverse = [1, 2, 3, 4, 5].map((n) => ({ x: n, y: -3 * n }))
    expect(pearson(inverse)).toBeCloseTo(-1, 5)
    expect(pearson([{ x: 1, y: 1 }])).toBeNull()
    expect(strengthOf(0.1)).toBe('none')
    expect(strengthOf(0.5)).toBe('moderate')
    expect(strengthOf(-0.9)).toBe('strong')
  })

  it('returns null r when one side has no variance', () => {
    expect(pearson([1, 2, 3, 4].map((n) => ({ x: n, y: 5 })))).toBeNull()
  })

  it('computes tercile cut points', () => {
    expect(terciles([1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual({ low: 4, high: 7 })
  })
})

describe('compareBuckets gates', () => {
  const pairsWithEffect = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      x: i % 2 === 0 ? 8 : 5,
      y: i % 2 === 0 ? 8 : 5,
    }))

  it('refuses a comparison below the day minimum', () => {
    const result = compareBuckets({ pairs: pairsWithEffect(10), threshold: 7, outcomeRange: 9 })
    expect(result.passed).toBe(false)
    expect(result.reason).toBe('too_few_days')
    expect(result.n).toBe(10)
  })

  it('refuses a comparison when one bucket is thin', () => {
    const pairs = [
      ...Array.from({ length: 25 }, () => ({ x: 8, y: 8 })),
      ...Array.from({ length: 3 }, () => ({ x: 5, y: 5 })),
    ]
    const result = compareBuckets({ pairs, threshold: 7, outcomeRange: 9 })
    expect(result.passed).toBe(false)
    expect(result.reason).toBe('thin_bucket')
  })

  it('refuses a difference too small to separate from noise', () => {
    const pairs = Array.from({ length: 30 }, (_, i) => ({
      x: i % 2 === 0 ? 8 : 5,
      y: i % 2 === 0 ? 7.1 : 7,
    }))
    const result = compareBuckets({ pairs, threshold: 7, outcomeRange: 9 })
    expect(result.passed).toBe(false)
    expect(result.reason).toBe('effect_too_small')
  })

  it('passes a real, well-sampled difference and reports both buckets', () => {
    const result = compareBuckets({ pairs: pairsWithEffect(30), threshold: 7, outcomeRange: 9 })
    expect(result.passed).toBe(true)
    expect(result.n).toBe(30)
    expect(result.high?.mean).toBe(8)
    expect(result.low?.mean).toBe(5)
    expect(result.high?.n).toBe(15)
    expect(result.difference).toBe(3)
    expect(result.threshold).toBe(7)
  })

  it('falls back to terciles when no natural threshold exists', () => {
    const pairs = Array.from({ length: 30 }, (_, i) => ({ x: i, y: i }))
    const result = compareBuckets({ pairs, outcomeRange: 30 })
    expect(result.passed).toBe(true)
    expect(result.threshold).toBeNull()
    expect(result.low?.label).toBe('low')
    expect(result.high?.label).toBe('high')
    expect((result.high?.mean ?? 0) > (result.low?.mean ?? 0)).toBe(true)
  })
})
