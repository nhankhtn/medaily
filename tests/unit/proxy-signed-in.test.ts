import { NextRequest } from 'next/server'
import { beforeAll, describe, expect, it } from 'vitest'
import { SESSION_COOKIE, signSession } from '@/lib/auth/session'
import { PATHS } from '@/lib/paths'
import { config, proxy } from '@/proxy'

const SECRET = 'a-secret-long-enough-to-pass'
let token = ''

beforeAll(async () => {
  process.env.AUTH_SECRET = SECRET
  process.env.AUTH_USERNAME = 'someone'
  process.env.AUTH_PASSWORD = 'something'
  token = await signSession(
    { uid: '11111111-1111-4111-8111-111111111111', sub: 'someone', provider: 'password' },
    SECRET,
  )
})

const visit = (path: string, signedIn: boolean) =>
  proxy(
    new NextRequest(`http://localhost${path}`, {
      headers: signedIn ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
    }),
  )

describe('the sign-in page turns away someone who is already signed in', () => {
  it('sends them home', async () => {
    const response = await visit('/login', true)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/')
  })

  it('sends them where they were headed', async () => {
    const response = await visit('/login?next=%2Fcalendar%3Fview%3Dweek', true)
    expect(response.headers.get('location')).toBe('http://localhost/calendar?view=week')
  })

  it('will not be talked into another site', async () => {
    const response = await visit('/login?next=%2F%2Fevil.example', true)
    expect(response.headers.get('location')).toBe('http://localhost/')
  })

  it('still shows the page to someone who is not', async () => {
    const response = await visit('/login', false)
    expect(response.status).toBe(200)
  })
})

describe('the matcher', () => {
  const matches = (path: string) => new RegExp(`^${config.matcher[0]}$`).test(path)

  it('lets the brand marks past without a session check', () => {
    expect(matches('/brands/momo.png')).toBe(false)
    expect(matches('/brands/bidv.svg')).toBe(false)
  })

  it('still guards a page', () => {
    expect(matches('/daily')).toBe(true)
    expect(matches('/brands')).toBe(true)
  })

  /**
   * The scraper building a link preview has no session and never will, so a
   * session check here is a blank card rather than a protected image.
   */
  it('lets the preview image past without a session check', () => {
    expect(matches('/opengraph-image')).toBe(false)
  })
})

describe('the bare address', () => {
  /**
   * A stranger typing the domain has not been turned away from anything, so
   * a sign-in form is the wrong answer — they may never have heard of it.
   */
  it('sends someone with no session to the page that says what this is', async () => {
    const response = await visit(PATHS.home, false)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(`http://localhost${PATHS.welcome}`)
  })

  it('still lets someone with a session straight in', async () => {
    const response = await visit(PATHS.home, true)
    expect(response.status).toBe(200)
  })

  it('keeps sending a deep link to sign-in, with somewhere to come back to', async () => {
    const response = await visit(PATHS.finance, false)
    expect(response.headers.get('location')).toBe(`http://localhost${PATHS.login}?next=%2Ffinance`)
  })
})

describe('what a crawler may reach', () => {
  it('serves robots.txt rather than redirecting it to the sign-in page', async () => {
    const response = await visit(PATHS.robots, false)
    expect(response.status).toBe(200)
  })

  /** Read before handing over a journal, so reachable before there is one. */
  it.each([['privacy'], ['terms']] as const)('serves the %s notice to anyone', async (kind) => {
    const response = await visit(PATHS.legal(kind), false)
    expect(response.status).toBe(200)
  })

  it('serves the welcome page to anyone', async () => {
    const response = await visit(PATHS.welcome, false)
    expect(response.status).toBe(200)
  })

  /** Everything robots.txt is there to keep out stays out. */
  it('still turns an anonymous visitor away from a page with personal data', async () => {
    const response = await visit(PATHS.finance, false)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain(PATHS.login)
  })
})

describe('the old notes address', () => {
  it('sends a bare link to the notes tab', async () => {
    const response = await visit(PATHS.knowledge, true)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(`http://localhost${PATHS.learningTab('notes')}`)
  })

  it('keeps the note that link was opening', async () => {
    const response = await visit(`${PATHS.knowledge}?note=n1`, true)
    expect(response.headers.get('location')).toBe(`http://localhost${PATHS.note('n1')}`)
  })

  it('moves a visitor with no session too, who then meets the sign-in page', async () => {
    const response = await visit(PATHS.knowledge, false)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/learning')
  })
})
