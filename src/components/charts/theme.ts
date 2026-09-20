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

/** Recharts cursor / hover band — translucent, not a second axis. */
export const CURSOR_FILL = 'var(--surface-2)'
export const CURSOR_STROKE = 'var(--border-strong)'

/** Gap between pie slices; solid so adjacent fills don't merge on glass. */
export const PIE_SLICE_STROKE = 'var(--surface-solid)'

/** Active point ring on line charts — reads over the series on glass panels. */
export const ACTIVE_DOT_STROKE = 'var(--surface-solid)'

/**
 * A ramp for slices of a whole — finance categories, where how many series
 * there are is whatever the person created rather than a fixed four.
 *
 * Built to the same rules as SERIES_COLORS: one lightness and one chroma per
 * mode, sitting in the same band as the app's own tokens, with the hues spaced
 * evenly round the wheel so that neighbouring slices stay apart for
 * colour-blind viewers as well. Eight is where a pie stops being readable, so
 * eight is all there is — the report folds the tail into one slice rather than
 * cycling back to the first colour and telling the same lie twice.
 *
 * Slices are labelled with their name and share in the list beside the chart,
 * so identity never rests on colour alone.
 */
export const CATEGORY_COLORS = {
  light: [
    'oklch(58% 0.13 275)',
    'oklch(58% 0.13 320)',
    'oklch(58% 0.13 5)',
    'oklch(58% 0.13 50)',
    'oklch(58% 0.13 95)',
    'oklch(58% 0.13 140)',
    'oklch(58% 0.13 185)',
    'oklch(58% 0.13 230)',
  ],
  dark: [
    'oklch(70% 0.14 275)',
    'oklch(70% 0.14 320)',
    'oklch(70% 0.14 5)',
    'oklch(70% 0.14 50)',
    'oklch(70% 0.14 95)',
    'oklch(70% 0.14 140)',
    'oklch(70% 0.14 185)',
    'oklch(70% 0.14 230)',
  ],
} as const

/** The colour a slice gets, by its place in the ranking. */
export function categoryColor(mode: 'light' | 'dark', index: number): string {
  const ramp = CATEGORY_COLORS[mode]
  return ramp[index % ramp.length] ?? ramp[0]
}
