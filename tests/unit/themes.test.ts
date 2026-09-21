import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrastOf, contrastRatio, oklchToRgb, parseOklch } from '@/lib/color/contrast'
import { DARK_THEME_IDS, THEMES, THEME_PREFERENCES, isThemePreference, themeBootScript } from '@/lib/themes'

const CSS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

/** The selector a theme's tokens live under: :root for light, .dark for dark. */
const selectorFor = (id: string) =>
  id === 'light' ? ':root' : id === 'dark' ? '.dark' : `[data-theme='${id}']`

function tokensOf(id: string): Record<string, string> {
  const selector = selectorFor(id)
  const start = CSS.indexOf(`\n${selector} {`)
  if (start === -1) throw new Error(`globals.css has no block for ${selector}`)

  const block = CSS.slice(start, CSS.indexOf('\n}', start))
  const tokens: Record<string, string> = {}
  for (const [, name, value] of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    if (name && value) tokens[name] = value.trim()
  }
  return tokens
}

describe('every theme has a palette', () => {
  const required = Object.keys(tokensOf('light'))

  it.each(THEMES.map((theme) => theme.id))('%s defines every token light does', (id) => {
    const tokens = tokensOf(id)
    // .dark inherits :root, so it only has to override the colours, not --radius.
    const missing = required.filter((name) => !(name in tokens) && !name.startsWith('--radius'))
    expect(missing).toEqual([])
  })
})

describe('every theme is readable', () => {
  // WCAG AA: 4.5 for body text, 3 for large text and UI boundaries.
  const pairs: [string, string, number][] = [
    ['--text', '--bg', 4.5],
    ['--text', '--surface', 4.5],
    ['--text-muted', '--bg', 4.5],
    ['--text-muted', '--surface', 4.5],
    ['--text-subtle', '--bg', 3],
    ['--accent-text', '--accent', 4.5],
    ['--accent', '--bg', 3],
    ['--border-strong', '--surface', 1.4],
    // The checkmark on a done habit / task / goal. A glyph is a non-text
    // graphic, so 3 — but it used to be a hardcoded `text-white`, which the
    // dark palette failed at 2.52 because no token was involved to test.
    ['--accent-text', '--good', 3],
    // The danger button's label, which is text.
    ['--accent-text', '--bad', 4.5],
  ]

  for (const theme of THEMES) {
    describe(theme.id, () => {
      const tokens = tokensOf(theme.id)
      const light = tokensOf('light')
      const read = (name: string) => tokens[name] ?? light[name] ?? ''

      it.each(pairs)('%s on %s clears %s:1', (front, back, minimum) => {
        // Surfaces are translucent, so they only have a colour once the page
        // behind them is painted in. Measure the composited stack.
        const ratio = contrastOf(read(front), read(back), read('--bg'))
        expect(ratio).not.toBeNull()
        expect(Number(ratio?.toFixed(2))).toBeGreaterThanOrEqual(minimum)
      })
    })
  }
})

describe('the colour maths', () => {
  it('reads an oklch colour, with or without alpha', () => {
    expect(parseOklch('oklch(55% 0.2 355)')).toEqual({ l: 0.55, c: 0.2, h: 355, alpha: 1 })
    expect(parseOklch('oklch(0% 0 0 / 0.3)')).toEqual({ l: 0, c: 0, h: 0, alpha: 0.3 })
    expect(parseOklch('#ff00aa')).toBeNull()
  })

  it('puts black and white where they belong', () => {
    const white = oklchToRgb({ l: 1, c: 0, h: 0 })
    const black = oklchToRgb({ l: 0, c: 0, h: 0 })
    expect(white.r).toBeCloseTo(1, 2)
    expect(black.r).toBeCloseTo(0, 2)
    expect(contrastRatio(white, black)).toBeCloseTo(21, 1)
  })

  it('gives a colour against itself a ratio of one', () => {
    expect(contrastOf('oklch(55% 0.2 355)', 'oklch(55% 0.2 355)')).toBeCloseTo(1, 5)
  })
})

describe('the registry', () => {
  it('offers system plus every theme', () => {
    expect(THEME_PREFERENCES[0]).toBe('system')
    expect(THEME_PREFERENCES).toHaveLength(THEMES.length + 1)
  })

  it('accepts only what it lists', () => {
    expect(isThemePreference('pink')).toBe(true)
    expect(isThemePreference('system')).toBe(true)
    expect(isThemePreference('mauve')).toBe(false)
    expect(isThemePreference(null)).toBe(false)
  })

  it('knows which themes are dark', () => {
    expect(DARK_THEME_IDS).toEqual(['dark'])
  })

  it('has a label for every theme', () => {
    const common = JSON.parse(
      readFileSync(join(process.cwd(), 'messages/vi.json'), 'utf8'),
    ).common as Record<string, string>

    for (const theme of THEMES) expect(common[theme.labelKey]).toBeTruthy()
    expect(common.themeSystem).toBeTruthy()
  })
})

describe('the boot script', () => {
  const script = themeBootScript()

  it('is one line, so it can sit inline in the head', () => {
    expect(script).not.toContain('\n')
  })

  it('carries the dark themes it has to recognise', () => {
    expect(script).toContain(JSON.stringify(DARK_THEME_IDS))
  })

  it('resolves the preference the way the toggle does', () => {
    const run = (pref: string, prefersDark: boolean) => {
      const root = {
        dataset: { themePref: pref } as Record<string, string>,
        classList: {
          toggled: null as null | boolean,
          toggle(_name: string, on: boolean) {
            this.toggled = on
          },
        },
      }
      const window = { matchMedia: () => ({ matches: prefersDark }) }
      new Function('document', 'window', script)({ documentElement: root }, window)
      return { theme: root.dataset.theme, dark: root.classList.toggled }
    }

    expect(run('pink', false)).toEqual({ theme: 'pink', dark: false })
    expect(run('pink', true)).toEqual({ theme: 'pink', dark: false })
    expect(run('light', true)).toEqual({ theme: 'light', dark: false })
    expect(run('dark', false)).toEqual({ theme: 'dark', dark: true })
    expect(run('system', true)).toEqual({ theme: 'dark', dark: true })
    expect(run('system', false)).toEqual({ theme: 'light', dark: false })
  })
})
