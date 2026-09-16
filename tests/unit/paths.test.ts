import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PATHS, PUBLIC_PATHS, STATIC_PAGE_PATHS, safeNextPath } from '@/lib/paths'

const APP = join(process.cwd(), 'src/app')
const PAGES = join(APP, '(app)')

const withoutQuery = (path: string) => path.split('?')[0] ?? path

function filesUnder(dir: string, name: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...filesUnder(full, name))
    else if (entry.name === name) out.push(full)
  }
  return out
}

describe('every path points at a page that exists', () => {
  it.each(STATIC_PAGE_PATHS)('%s', (path) => {
    const folder = join(PAGES, withoutQuery(path))
    expect(existsSync(join(folder, 'page.tsx'))).toBe(true)
  })

  it.each([PATHS.api.health, PATHS.api.googleAuth, PATHS.api.calendarIcs, PATHS.api.exportJson])(
    '%s',
    (path) => {
      expect(existsSync(join(APP, withoutQuery(path), 'route.ts'))).toBe(true)
    },
  )

  it('covers the login page, which sits outside the app shell', () => {
    expect(existsSync(join(APP, PATHS.login, 'page.tsx'))).toBe(true)
  })
})

describe('every page is reachable from a path', () => {
  it('lists each fixed-address page in STATIC_PAGE_PATHS', () => {
    const onDisk = filesUnder(PAGES, 'page.tsx')
      .map((file) => `/${relative(PAGES, file).replace(/\/?page\.tsx$/, '')}`)
      // Dynamic segments are built by the functions on PATHS, not listed.
      .filter((route) => !route.includes('['))
      .map((route) => (route === '/' ? '/' : route))

    const listed = new Set(STATIC_PAGE_PATHS.map(withoutQuery))
    expect(onDisk.filter((route) => !listed.has(route))).toEqual([])
  })
})

describe('routes are spelled out nowhere but paths.ts', () => {
  const LITERALS = [
    /href="\//,
    /href=\{`\//,
    /revalidatePath\(['"`]\//,
    /\bredirect\(['"`]\//,
    /router\.(push|replace)\(['"`]\//,
    // A route handed back from a function is just as easy to leave behind.
    /return ['"`]\/[a-z]/,
    /=> ['"`]\/[a-z]/,
  ]

  const sources = [
    ...filesUnder(join(process.cwd(), 'src'), 'page.tsx'),
    ...readdirSync(join(process.cwd(), 'src'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => walk(join(process.cwd(), 'src', entry.name))),
  ]

  function walk(dir: string): string[] {
    const out: string[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) out.push(...walk(full))
      else if (/\.tsx?$/.test(entry.name)) out.push(full)
    }
    return out
  }

  it('finds no hard-coded route anywhere in src', () => {
    const offenders = [...new Set(sources)]
      .filter((file) => !file.endsWith('lib/paths.ts'))
      .filter((file) => LITERALS.some((pattern) => pattern.test(readFileSync(file, 'utf8'))))
      .map((file) => relative(process.cwd(), file))

    expect(offenders).toEqual([])
  })
})

describe('the built paths', () => {
  it('puts an id where it belongs', () => {
    expect(PATHS.dailyOn('2026-09-13')).toBe('/daily/2026-09-13')
    expect(PATHS.project('abc')).toBe('/projects/abc')
    expect(PATHS.note('n1')).toBe('/knowledge?note=n1')
  })

  it('opens one record in its module', () => {
    expect(PATHS.journalEntry('j1')).toBe('/journal?entry=j1')
  })

  it('builds the calendar with only the parts it was given', () => {
    expect(PATHS.calendar()).toBe('/calendar')
    expect(PATHS.calendar({ view: 'month' })).toBe('/calendar?view=month')
    expect(PATHS.calendar({ view: 'week', at: '2026-09-13' })).toBe(
      '/calendar?view=week&at=2026-09-13',
    )
  })

  it('keeps the public list to routes that really are public', () => {
    expect(PUBLIC_PATHS).toContain(PATHS.login)
    expect(PUBLIC_PATHS).not.toContain(PATHS.daily)
  })
})

describe('safeNextPath', () => {
  it('keeps a path on this site, query and all', () => {
    expect(safeNextPath('/daily')).toBe('/daily')
    expect(safeNextPath('/calendar?view=week')).toBe('/calendar?view=week')
  })

  it('refuses anything that is really another origin', () => {
    expect(safeNextPath('//evil.example')).toBe(PATHS.home)
    expect(safeNextPath('/\\evil.example')).toBe(PATHS.home)
    expect(safeNextPath('https://evil.example')).toBe(PATHS.home)
    expect(safeNextPath('javascript:alert(1)')).toBe(PATHS.home)
  })

  it('refuses the sign-in page, which would be a loop', () => {
    expect(safeNextPath(PATHS.login)).toBe(PATHS.home)
    expect(safeNextPath('/login?next=%2Flogin')).toBe(PATHS.home)
  })

  it('falls back when there is nothing to go back to', () => {
    expect(safeNextPath(null)).toBe(PATHS.home)
    expect(safeNextPath('')).toBe(PATHS.home)
  })
})
