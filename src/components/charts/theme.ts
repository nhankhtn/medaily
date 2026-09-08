/**
 * Chart colours are picked per mode and validated with the dataviz palette
 * checker (lightness band, chroma floor, CVD separation, contrast), not by eye.
 *
 * Each trend facet renders a single series under its own title, so identity
 * never depends on colour alone — which is also what makes the one amber↔rose
 * CVD warn band acceptable in dark mode.
 */
export const SERIES_COLORS = {
  light: {
    focus: '#4f5fd7',
    sleep: '#00a39a',
    energy: '#c2790a',
    entertainment: '#d13a52',
  },
  dark: {
    focus: '#6f7bee',
    sleep: '#12a396',
    energy: '#c2851c',
    entertainment: '#dd5165',
  },
} as const

export type SeriesKey = keyof (typeof SERIES_COLORS)['light']

export const AXIS_COLOR = 'var(--text-subtle)'
export const GRID_COLOR = 'var(--border)'
