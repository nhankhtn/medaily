import { describe, expect, it } from 'vitest'
import {
  renewalTtl,
  sessionStartedAt,
  signSession,
  verifySession,
  type SessionPayload,
} from '@/lib/auth/session'

const DAY = 60 * 60 * 24
const TTL = 30 * DAY
const CEILING = 180 * DAY

/** In the past, because one test signs a real token against the real clock. */
const SIGNED_IN_AT = 1_700_000_000

const session = (over: Partial<SessionPayload> = {}): SessionPayload => ({
  v: 2,
  uid: 'a1b2',
  sub: 'me@example.com',
  provider: 'google',
  iat: SIGNED_IN_AT,
  exp: SIGNED_IN_AT + TTL,
  sat: SIGNED_IN_AT,
  ...over,
})

describe('renewalTtl', () => {
  it('leaves a fresh cookie alone', () => {
    expect(renewalTtl(session(), SIGNED_IN_AT + DAY)).toBeNull()
  })

  it('still leaves it alone a moment before halfway', () => {
    expect(renewalTtl(session(), SIGNED_IN_AT + TTL / 2 - 1)).toBeNull()
  })

  it('renews for a full term once past halfway', () => {
    expect(renewalTtl(session(), SIGNED_IN_AT + TTL / 2 + 1)).toBe(TTL)
  })

  /**
   * The point of the halfway rule: a renewal resets `iat`, so the next one
   * cannot come for another half-life however many pages are opened. Without
   * it every request would re-sign the cookie.
   */
  it('does not renew again immediately after renewing', () => {
    const renewedAt = SIGNED_IN_AT + TTL / 2 + 1
    const renewed = session({ iat: renewedAt, exp: renewedAt + TTL })
    expect(renewalTtl(renewed, renewedAt + DAY)).toBeNull()
  })
})

describe('the ceiling', () => {
  /** Used every fortnight for years, and it still ends six months in. */
  it('stops renewing a session that has been kept alive to the ceiling', () => {
    let current = session()
    let now = SIGNED_IN_AT
    let renewals = 0

    // Walk forward a fortnight at a time, renewing whenever it is offered.
    for (let step = 0; step < 100; step++) {
      now += 14 * DAY
      const ttl = renewalTtl(current, now)
      if (ttl === null) continue
      renewals += 1
      current = session({ iat: now, exp: now + ttl, sat: SIGNED_IN_AT })
    }

    expect(renewals).toBeGreaterThan(5)
    expect(current.exp).toBeLessThanOrEqual(SIGNED_IN_AT + CEILING)
    // And the walk ran well past the ceiling without ever crossing it.
    expect(now).toBeGreaterThan(SIGNED_IN_AT + CEILING)
  })

  it('refuses outright once the sign-in is older than the ceiling', () => {
    const old = session({ iat: SIGNED_IN_AT + CEILING, exp: SIGNED_IN_AT + CEILING + TTL })
    expect(renewalTtl(old, SIGNED_IN_AT + CEILING + TTL / 2 + 1)).toBeNull()
  })

  /**
   * Near the end the clamp shortens each renewal, which would otherwise make
   * halfway arrive sooner and sooner — a re-sign on every page for the last
   * day. A renewal that buys no time is refused instead.
   */
  it('refuses a renewal that would not extend anything', () => {
    const iat = SIGNED_IN_AT + CEILING - 2 * DAY
    const nearly = session({ iat, exp: iat + 4 * DAY })
    // Past halfway, but the ceiling is closer than the current expiry.
    expect(renewalTtl(nearly, iat + 3 * DAY)).toBeNull()
  })

  it('never hands back a term that reaches past the ceiling', () => {
    const iat = SIGNED_IN_AT + CEILING - 40 * DAY
    const late = session({ iat, exp: iat + TTL })
    const now = iat + TTL / 2 + 1
    const ttl = renewalTtl(late, now)
    expect(ttl).not.toBeNull()
    // Shorter than a full term, and landing exactly on the ceiling.
    expect(ttl!).toBeLessThan(TTL)
    expect(now + ttl!).toBe(SIGNED_IN_AT + CEILING)
  })
})

describe('a cookie issued before any of this existed', () => {
  /**
   * `sat` was added to the payload without bumping the version, so cookies
   * already in browsers stay valid. Their `iat` is the sign-in they came
   * from, which is what `sat` means — reading it any other way would either
   * sign everyone out on deploy or give old cookies no ceiling at all.
   */
  it('takes its issued-at as the sign-in it came from', () => {
    const { sat: _dropped, ...legacy } = session()
    expect(sessionStartedAt(legacy)).toBe(SIGNED_IN_AT)
  })

  it('is renewed like any other', () => {
    const { sat: _dropped, ...legacy } = session()
    expect(renewalTtl(legacy, SIGNED_IN_AT + TTL / 2 + 1)).toBe(TTL)
  })

  /**
   * And its ceiling counts from the cookie in hand, not from the sign-in that
   * really started it — which may be months earlier and is not written down
   * anywhere. So a cookie already in a browser on the day this ships gets up
   * to a full six months from that day.
   *
   * The alternative is rejecting every cookie without `sat`, which signs
   * everyone out to enforce a ceiling on sessions that had none until now.
   * This is the milder of the two, and it is self-correcting: it can only
   * happen once, to cookies that existed before the rule did.
   */
  it('counts its ceiling from itself, because nothing older was recorded', () => {
    const { sat: _dropped, ...legacy } = session()
    expect(sessionStartedAt(legacy)).toBe(legacy.iat)

    const renewedOnce = session({ iat: SIGNED_IN_AT + CEILING, exp: SIGNED_IN_AT + CEILING + TTL })
    const { sat: _also, ...asLegacy } = renewedOnce
    expect(renewalTtl(asLegacy, SIGNED_IN_AT + CEILING + TTL / 2 + 1)).toBe(TTL)

    // Once it carries `sat`, the ceiling binds it like everything else.
    expect(renewalTtl(renewedOnce, SIGNED_IN_AT + CEILING + TTL / 2 + 1)).toBeNull()
  })
})

describe('signing a renewal', () => {
  const SECRET = 'a-secret-long-enough-to-be-real'

  it('carries the original sign-in forward instead of restarting it', async () => {
    const token = await signSession(
      { uid: 'a1b2', sub: 'me@example.com', provider: 'google', sat: SIGNED_IN_AT },
      SECRET,
      TTL,
    )
    const read = await verifySession(token, SECRET)
    expect(read?.sat).toBe(SIGNED_IN_AT)
    // Issued now, so the halfway clock restarts even though the ceiling does not.
    expect(read!.iat).toBeGreaterThan(SIGNED_IN_AT)
  })

  it('starts the clock for a sign-in that names no earlier one', async () => {
    const token = await signSession(
      { uid: 'a1b2', sub: 'me@example.com', provider: 'password' },
      SECRET,
      TTL,
    )
    const read = await verifySession(token, SECRET)
    expect(read?.sat).toBe(read?.iat)
  })
})
