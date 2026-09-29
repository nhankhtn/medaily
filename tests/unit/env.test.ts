import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * `lib/env` parses once at import, so each case sets the environment and then
 * asks for a fresh copy of the module.
 */
async function loadEnv(values: Record<string, string | undefined>) {
  const saved = { ...process.env }
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  vi.resetModules()
  const module = await import('@/lib/env')
  process.env = saved
  return module
}

afterEach(() => {
  vi.resetModules()
})

/**
 * `.env.example` lists every variable uncommented, most of them blank, because
 * a key commented out is a key nobody knows exists. That only works if a blank
 * value means *not set* — otherwise copying the example hands the schema an
 * empty string and it reports three configuration errors for variables nobody
 * asked for.
 */
describe('a blank value in the environment', () => {
  it('leaves an optional variable unset rather than empty', async () => {
    const { env } = await loadEnv({ DATABASE_URL: 'postgres://x', SITE_URL: '   ' })
    expect(env.SITE_URL).toBeUndefined()
  })

  it.each([
    ['LEGAL_CONTACT_EMAIL', 'would fail as a malformed address'],
    ['AUTH_SECRET', 'would fail as too short'],
  ])('does not make %s an error — it %s', async (name) => {
    const { envIssues } = await loadEnv({ DATABASE_URL: 'postgres://x', [name]: '' })
    expect(envIssues.filter((issue) => issue.startsWith(name))).toEqual([])
  })

  /** Coercion is the sharp one: `Number('')` is 0, and zero is not "unset". */
  it('lets a blank number fall back to the default instead of coercing to zero', async () => {
    const { env, envIssues } = await loadEnv({
      DATABASE_URL: 'postgres://x',
      ACTIVITY_LOG_DAYS: '',
    })
    expect(env.ACTIVITY_LOG_DAYS).toBe(90)
    expect(envIssues).toEqual([])
  })

  it('still reads a value that is actually there', async () => {
    const { env } = await loadEnv({ DATABASE_URL: 'postgres://x', ACTIVITY_LOG_DAYS: '30' })
    expect(env.ACTIVITY_LOG_DAYS).toBe(30)
  })

  it('still reports a value that is present and wrong', async () => {
    const { envIssues } = await loadEnv({
      DATABASE_URL: 'postgres://x',
      LEGAL_CONTACT_EMAIL: 'not-an-address',
    })
    expect(envIssues.some((issue) => issue.startsWith('LEGAL_CONTACT_EMAIL'))).toBe(true)
  })
})
