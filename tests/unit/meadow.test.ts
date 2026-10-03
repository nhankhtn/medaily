import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ISODate } from '@/lib/dates'
import { MEADOW_SCENES, meadowSceneFor, meadowSceneVars } from '@/lib/meadow'

const nextDay = (day: ISODate): ISODate => {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10) as ISODate
}

describe('meadow scenery', () => {
  it('ships a wide file and a portrait cut for every scene', () => {
    for (const scene of MEADOW_SCENES) {
      expect(existsSync(join(process.cwd(), 'public', scene.landscape.slice(1)))).toBe(true)
      expect(existsSync(join(process.cwd(), 'public', scene.portrait.slice(1)))).toBe(true)
    }
  })

  it('keeps the same picture for a day', () => {
    const day = '2026-10-03' as ISODate
    const scene = meadowSceneFor(day)
    const vars = meadowSceneVars(day) as Record<string, string>
    expect(meadowSceneFor(day)).toEqual(scene)
    expect(vars['--meadow-landscape']).toContain(scene.landscape)
    expect(vars['--meadow-portrait']).toContain(scene.portrait)
  })

  it('gives each weekday its own scene and repeats it the next week', () => {
    expect(MEADOW_SCENES).toHaveLength(7)
    // 2026-10-05 is a Monday.
    let day = '2026-10-05' as ISODate
    const week = MEADOW_SCENES.map((scene) => {
      const landscape = meadowSceneFor(day).landscape
      day = nextDay(day)
      return landscape
    })
    expect(week).toEqual(MEADOW_SCENES.map((scene) => scene.landscape))
    expect(meadowSceneFor('2026-10-12' as ISODate).landscape).toBe(week[0])
  })
})