import { describe, expect, it } from 'vitest'
import en from '../../messages/en.json'
import vi from '../../messages/vi.json'

type Messages = { [key: string]: string | Messages }

function flatten(messages: Messages, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(messages)) {
    if (typeof value === 'string') out[prefix + key] = value
    else Object.assign(out, flatten(value, `${prefix}${key}.`))
  }
  return out
}

const flatEn = flatten(en as Messages)
const flatVi = flatten(vi as Messages)

describe('translation parity', () => {
  it('has no key missing from Vietnamese', () => {
    const missing = Object.keys(flatEn).filter((key) => !(key in flatVi))
    expect(missing).toEqual([])
  })

  it('has no orphaned Vietnamese key', () => {
    const orphaned = Object.keys(flatVi).filter((key) => !(key in flatEn))
    expect(orphaned).toEqual([])
  })

  it('has no empty string on either side', () => {
    const empty = [
      ...Object.entries(flatEn).filter(([, value]) => value.trim() === ''),
      ...Object.entries(flatVi).filter(([, value]) => value.trim() === ''),
    ]
    expect(empty).toEqual([])
  })

  it('uses the same interpolation placeholders in both locales', () => {
    // Only real placeholders: a name followed by `}` or `,`. This skips the
    // literal sub-messages inside an ICU plural block, which legitimately
    // differ between the two languages.
    const placeholders = (value: string) =>
      [...value.matchAll(/\{(\w+)\s*(?:,|\})/g)].map((match) => match[1]).sort()

    const mismatches = Object.keys(flatEn)
      .filter((key) => key in flatVi)
      .filter((key) => {
        const a = placeholders(flatEn[key] ?? '')
        const b = placeholders(flatVi[key] ?? '')
        return JSON.stringify(a) !== JSON.stringify(b)
      })

    expect(mismatches).toEqual([])
  })
})

/**
 * Spec 18.3 — insight and comparison copy states associations only. This test
 * is the enforcement mechanism: a causal verb in those namespaces fails CI in
 * both languages, in generated text and in hand-written text alike.
 */
describe('non-causal wording in insight and analytics copy', () => {
  const FORBIDDEN_EN = [
    'cause',
    'causes',
    'caused',
    'because of',
    'leads to',
    'lead to',
    'makes you',
    'improves',
    'improved',
    'boosts',
    'results in',
    'due to',
    'thanks to',
  ]
  const FORBIDDEN_VI = [
    'gây ra',
    'dẫn đến',
    'làm cho',
    'khiến',
    'nhờ vào',
    'nhờ có',
    'do đó mà',
    'cải thiện',
    'giúp tăng',
    'giúp cải thiện',
  ]

  const namespaces = ['insights.', 'analytics.']
  const entries = (flat: Record<string, string>) =>
    Object.entries(flat).filter(([key]) => namespaces.some((ns) => key.startsWith(ns)))

  it('checks a meaningful number of strings', () => {
    expect(entries(flatEn).length).toBeGreaterThan(20)
  })

  it('has no causal verb in English insight or analytics copy', () => {
    const offenders = entries(flatEn).filter(([, value]) =>
      FORBIDDEN_EN.some((word) => value.toLowerCase().includes(word)),
    )
    expect(offenders).toEqual([])
  })

  it('has no causal verb in Vietnamese insight or analytics copy', () => {
    const offenders = entries(flatVi).filter(([, value]) =>
      FORBIDDEN_VI.some((word) => value.toLowerCase().includes(word)),
    )
    expect(offenders).toEqual([])
  })
})
