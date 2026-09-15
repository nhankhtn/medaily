/**
 * Which numbers a habit or a goal is allowed to bind to.
 *
 * The built-in metrics are columns on the daily log; the ones a person adds
 * themselves are rows in `custom_metrics`. Both are addressed by key, and the
 * derivation already reads either — this decides which of the custom ones are
 * offered, and what threshold to open the form on.
 */
export type BindableMetric = {
  key: string
  label: string
  /** A starting threshold on that metric's own scale, so the box is never blank. */
  suggested: number
}

/** As much of a `custom_metrics` row as the choice depends on. */
export type CustomMetricRow = {
  key: string
  labelEn: string
  labelVi: string
  type: 'number' | 'boolean' | 'scale' | 'text' | 'duration'
  min: string | null
  max: string | null
  archivedAt: Date | null
}

/** Half an hour, the unit a duration metric is usually aimed at. */
const DURATION_DEFAULT = 30

const SCALE_FLOOR = 1
const SCALE_CEILING = 10

function suggestedFor(row: CustomMetricRow): number {
  switch (row.type) {
    // "It happened today" — the only threshold a yes/no can carry.
    case 'boolean':
      return 1
    case 'duration':
      return DURATION_DEFAULT
    case 'scale': {
      const min = row.min === null ? SCALE_FLOOR : Number(row.min)
      const max = row.max === null ? SCALE_CEILING : Number(row.max)
      return Math.round((min + max) / 2)
    }
    default:
      return 1
  }
}

export function bindableCustomMetrics(
  rows: CustomMetricRow[],
  locale: 'en' | 'vi',
): BindableMetric[] {
  return rows
    .filter((row) => {
      // Archived means the person stopped tracking it; binding to it would
      // freeze the habit at whatever it last read.
      if (row.archivedAt !== null) return false
      // A note has no number to compare a threshold against.
      return row.type !== 'text'
    })
    .map((row) => ({
      key: row.key,
      label: (locale === 'vi' ? row.labelVi : row.labelEn).trim() || row.key,
      suggested: suggestedFor(row),
    }))
}
