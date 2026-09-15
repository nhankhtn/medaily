import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MARK_PATH, TILE_FROM, TILE_TO, markSvg } from '@/lib/brand'

/**
 * `app/icon.svg` has to be a static file for Next to pick it up, so it cannot
 * import the constants. This is what stops it drifting into a second logo.
 */
const favicon = readFileSync(resolve('src/app/icon.svg'), 'utf8')

describe('the favicon', () => {
  it('draws the same mark as the component', () => {
    expect(favicon).toContain(`d="${MARK_PATH}"`)
  })

  it('uses the brand gradient', () => {
    expect(favicon).toContain(TILE_FROM)
    expect(favicon).toContain(TILE_TO)
  })

  it('keeps its corners, unlike the iOS one', () => {
    expect(favicon).toMatch(/rx="\d+"/)
    expect(markSvg({ rounded: false })).not.toContain('rx=')
  })
})

describe('markSvg', () => {
  it('is standalone SVG, so it can be a data URI', () => {
    const svg = markSvg()
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
  })

  it('draws one stroked path and nothing else to go wrong at 16px', () => {
    expect(markSvg().match(/<path/g)).toHaveLength(1)
  })
})
