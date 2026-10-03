import type { CSSProperties } from 'react'
import { isoWeekday, type ISODate } from '@/lib/dates'

/**
 * Meadow's pictures. Each one is filed twice: the wide view, and a tall cut
 * around its subject for a phone held upright. The wide file on its own would
 * show the middle of the panorama.
 *
 * One picture for each weekday, Monday through Sunday, in this order. The
 * same day next week is the same hillside, and a refresh during the day
 * cannot swap it.
 */
export type MeadowScene = {
  landscape: string
  portrait: string
}

export const MEADOW_SCENES: readonly MeadowScene[] = [
  { landscape: '/themes/meadow.webp', portrait: '/themes/meadow-portrait.webp' },
  { landscape: '/themes/meadow-road.webp', portrait: '/themes/meadow-road-portrait.webp' },
  { landscape: '/themes/meadow-shrine.webp', portrait: '/themes/meadow-shrine-portrait.webp' },
  { landscape: '/themes/meadow-river.webp', portrait: '/themes/meadow-river-portrait.webp' },
  { landscape: '/themes/meadow-house.webp', portrait: '/themes/meadow-house-portrait.webp' },
  { landscape: '/themes/meadow-blossom.webp', portrait: '/themes/meadow-blossom-portrait.webp' },
  { landscape: '/themes/meadow-field.webp', portrait: '/themes/meadow-field-portrait.webp' },
]

const layer = (path: string) => `url('${path}') center bottom / cover no-repeat`

/** The two custom properties `--bg-atmosphere` reads. */
export function meadowSceneVars(day: ISODate): CSSProperties {
  const scene = meadowSceneFor(day)
  return {
    '--meadow-landscape': layer(scene.landscape),
    '--meadow-portrait': layer(scene.portrait),
  } as CSSProperties
}

/** Monday is the first scene, Sunday the last. */
export function meadowSceneFor(day: ISODate): MeadowScene {
  return MEADOW_SCENES[isoWeekday(day) - 1] as MeadowScene
}
