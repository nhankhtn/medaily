import { describe, expect, it } from 'vitest'
import {
  CAPTURE_MODULES,
  matchModules,
  slashQuery,
  type CaptureModule,
} from '../../src/lib/capture/modules'

/** Stands in for the translated label the box passes in. */
const labelOf = (module: CaptureModule) => (module.key === 'finance' ? 'Tài chính' : module.key)

describe('slashQuery', () => {
  it('opens on a leading slash and reports what follows', () => {
    expect(slashQuery('/')).toBe('')
    expect(slashQuery('/fin')).toBe('fin')
  })

  it('stays closed for a slash that is not leading', () => {
    expect(slashQuery('ăn sáng 30k / 2 người')).toBeNull()
    expect(slashQuery('')).toBeNull()
  })

  it('closes once the token ends, so a note is not shadowed by the menu', () => {
    expect(slashQuery('/finance ăn sáng 30k')).toBeNull()
  })
})

describe('matchModules', () => {
  it('lists everything for a bare slash', () => {
    expect(matchModules('', labelOf)).toHaveLength(CAPTURE_MODULES.length)
  })

  it('matches on the key', () => {
    expect(matchModules('fin', labelOf).map((module) => module.key)).toEqual(['finance'])
  })

  it('matches on the translated label, accents and all', () => {
    expect(matchModules('tài', labelOf).map((module) => module.key)).toEqual(['finance'])
  })

  it('matches on an alias', () => {
    expect(matchModules('chi tiêu', labelOf).map((module) => module.key)).toEqual(['finance'])
  })

  it('returns nothing for a word no module claims', () => {
    expect(matchModules('zzz', labelOf)).toEqual([])
  })
})
