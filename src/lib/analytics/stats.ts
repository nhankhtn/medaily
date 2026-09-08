/** Pure statistics used by the analytics module. No database, no I/O. */

export function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? null
  const lo = sorted[mid - 1]
  const hi = sorted[mid]
  if (lo === undefined || hi === undefined) return null
  return (lo + hi) / 2
}

/**
 * Trailing moving average over a series that may contain gaps. A window with no
 * data yields null rather than 0 — not logging is not a zero (spec 38.5).
 */
export function movingAverage(series: (number | null)[], window: number): (number | null)[] {
  return series.map((_, i) => {
    const slice = series.slice(Math.max(0, i - window + 1), i + 1)
    const present = slice.filter((v): v is number => v !== null)
    return present.length ? mean(present) : null
  })
}

export function stdDev(values: number[]): number | null {
  const m = mean(values)
  if (m === null || values.length < 2) return null
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

export type Pair = { x: number; y: number }

/** Pearson r. Returned only as a secondary number, never on its own (spec 18.3). */
export function pearson(pairs: Pair[]): number | null {
  if (pairs.length < 3) return null
  const xs = pairs.map((p) => p.x)
  const ys = pairs.map((p) => p.y)
  const mx = mean(xs)
  const my = mean(ys)
  if (mx === null || my === null) return null

  let num = 0
  let dx2 = 0
  let dy2 = 0
  for (const { x, y } of pairs) {
    const dx = x - mx
    const dy = y - my
    num += dx * dy
    dx2 += dx * dx
    dy2 += dy * dy
  }
  const den = Math.sqrt(dx2 * dy2)
  if (den === 0) return null
  return num / den
}

export type CorrelationStrength = 'none' | 'weak' | 'moderate' | 'strong'

export function strengthOf(r: number | null): CorrelationStrength {
  if (r === null) return 'none'
  const abs = Math.abs(r)
  if (abs < 0.2) return 'none'
  if (abs < 0.4) return 'weak'
  if (abs < 0.6) return 'moderate'
  return 'strong'
}

/** Tercile cut points, used when a metric has no natural threshold. */
export function terciles(values: number[]): { low: number; high: number } | null {
  if (values.length < 3) return null
  const sorted = [...values].sort((a, b) => a - b)
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
  const low = at(1 / 3)
  const high = at(2 / 3)
  if (low === undefined || high === undefined) return null
  return { low, high }
}
