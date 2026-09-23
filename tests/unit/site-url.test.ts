import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * `siteUrl` is read once per render to build absolute URLs, and the wrong
 * answer is the kind nobody notices: a preview card that points at a preview
 * deployment which stops existing a week later.
 *
 * The module reads `env` at call time but `SITE_URL` through it, so each case
 * re-imports with the environment it wants.
 */
const load = async (vars: Record<string, string | undefined>) => {
  vi.resetModules()
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return (await import('@/lib/site')).siteUrl()
}

afterEach(() => {
  delete process.env.SITE_URL
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL
})

describe('siteUrl', () => {
  it('prefers the configured address, which is the one people paste', async () => {
    const url = await load({
      SITE_URL: 'https://medaily.example.com',
      VERCEL_PROJECT_PRODUCTION_URL: 'project.vercel.app',
    })
    expect(url.origin).toBe('https://medaily.example.com')
  })

  it('accepts a bare hostname, because that is how one is usually pasted', async () => {
    const url = await load({ SITE_URL: 'medaily.example.com' })
    expect(url.origin).toBe('https://medaily.example.com')
  })

  it('falls back to the deployment hostname', async () => {
    const url = await load({
      SITE_URL: undefined,
      VERCEL_PROJECT_PRODUCTION_URL: 'project.vercel.app',
    })
    expect(url.origin).toBe('https://project.vercel.app')
  })

  it('lands on localhost when nothing is configured', async () => {
    const url = await load({ SITE_URL: undefined, VERCEL_PROJECT_PRODUCTION_URL: undefined })
    expect(url.origin).toBe('http://localhost:3000')
  })

  it('ignores an empty string rather than treating it as an address', async () => {
    const url = await load({ SITE_URL: '   ', VERCEL_PROJECT_PRODUCTION_URL: undefined })
    expect(url.origin).toBe('http://localhost:3000')
  })
})
