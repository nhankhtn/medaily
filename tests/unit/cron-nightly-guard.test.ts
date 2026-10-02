import { beforeEach, describe, expect, it, vi } from 'vitest'

const rolloverBudgets = vi.fn()
const sweepNoteImages = vi.fn()
const sweepRealtimeChannels = vi.fn()
const findAllUserIds = vi.fn()

vi.mock('@/lib/env', () => ({ env: { CRON_SECRET: 'the-secret' } }))
vi.mock('@/lib/log', () => ({
  log: { info: vi.fn(), error: vi.fn(async () => {}) },
}))
vi.mock('@/server/repositories/auth', () => ({ findAllUserIds }))
vi.mock('@/server/services/budget-rollover', () => ({ rolloverBudgets }))
vi.mock('@/server/services/note-images', () => ({ sweepNoteImages }))
vi.mock('@/server/services/realtime-gc', () => ({ sweepRealtimeChannels }))
vi.mock('@/server/services/alerts', () => ({
  sendJobReport: vi.fn(async () => {}),
  environmentName: () => 'test',
}))

const { GET } = await import('@/app/api/cron/nightly/route')

const call = (headers: Record<string, string>) =>
  GET(new Request('https://example.com/api/cron/nightly', { headers }))

/**
 * This route is in `PUBLIC_PATHS`: it never meets the session gate, so the
 * secret is the only thing in front of it. It once stopped being — the check
 * was moved into a helper that still built the refusal, while the caller threw
 * the refusal away and carried on. Anybody could then run a job that deletes
 * images for every account.
 *
 * So the test is not "does it refuse" but "does it refuse *and stop*".
 */
describe('the nightly cron route', () => {
  beforeEach(() => {
    findAllUserIds.mockReset().mockResolvedValue(['u1'])
    rolloverBudgets.mockReset().mockResolvedValue({ created: 0 })
    sweepNoteImages.mockReset().mockResolvedValue({ removed: 0, freedBytes: 0 })
    sweepRealtimeChannels.mockReset().mockResolvedValue(null)
  })

  const didNothing = () => {
    expect(findAllUserIds, 'it must not even read the account list').not.toHaveBeenCalled()
    expect(rolloverBudgets).not.toHaveBeenCalled()
    expect(sweepNoteImages, 'this one deletes files').not.toHaveBeenCalled()
    expect(sweepRealtimeChannels).not.toHaveBeenCalled()
  }

  it('refuses a caller with no authorization, and runs nothing', async () => {
    const response = await call({})

    expect(response?.status).toBe(401)
    didNothing()
  })

  it('refuses a wrong secret, and runs nothing', async () => {
    const response = await call({ authorization: 'Bearer not-the-secret' })

    expect(response?.status).toBe(401)
    didNothing()
  })

  /** A scheduler user-agent is not a credential; it only shapes the log line. */
  it('refuses something claiming to be the scheduler without the secret', async () => {
    const response = await call({ 'user-agent': 'vercel-cron/1.0' })

    expect(response?.status).toBe(401)
    didNothing()
  })

  it('runs the job for the caller that knows the secret', async () => {
    const response = await call({ authorization: 'Bearer the-secret' })

    expect(response?.status).toBe(200)
    expect(rolloverBudgets).toHaveBeenCalledWith('u1')
    expect(sweepNoteImages).toHaveBeenCalledWith('u1')
  })
})
