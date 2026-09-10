import { describe, expect, it } from 'vitest'
import { emailIsPermitted, type AccessPolicy } from '@/lib/auth/config'

/**
 * The allowlist is the whole difference between "my private journal" and
 * "anyone with a Google account can register on my journal", so its default
 * — deny — is tested as carefully as its allow paths.
 */
const closed: AccessPolicy = {
  ownerEmail: null,
  allowedEmails: [],
  allowedDomains: [],
  allowSignup: false,
}

describe('emailIsPermitted', () => {
  it('denies everyone when nothing is configured', () => {
    expect(emailIsPermitted('someone@gmail.com', closed)).toBe(false)
    expect(emailIsPermitted('owner@gmail.com', closed)).toBe(false)
  })

  it('allows the owner address', () => {
    const policy = { ...closed, ownerEmail: 'owner@gmail.com' }
    expect(emailIsPermitted('owner@gmail.com', policy)).toBe(true)
    expect(emailIsPermitted('someone@gmail.com', policy)).toBe(false)
  })

  it('ignores case and surrounding space, as Google addresses arrive normalized', () => {
    const policy = { ...closed, ownerEmail: 'owner@gmail.com' }
    expect(emailIsPermitted('  Owner@Gmail.com ', policy)).toBe(true)
  })

  it('allows a listed address', () => {
    const policy = { ...closed, allowedEmails: ['a@x.com', 'b@y.com'] }
    expect(emailIsPermitted('b@y.com', policy)).toBe(true)
    expect(emailIsPermitted('c@y.com', policy)).toBe(false)
  })

  it('allows a listed domain', () => {
    const policy = { ...closed, allowedDomains: ['hasaki.vn'] }
    expect(emailIsPermitted('anyone@hasaki.vn', policy)).toBe(true)
    expect(emailIsPermitted('anyone@hasaki.vn.evil.com', policy)).toBe(false)
    expect(emailIsPermitted('anyone@notahasaki.vn', policy)).toBe(false)
  })

  /**
   * Open signup only widens the gate when no list was given. A configured
   * list keeps its meaning: "these, and nobody else".
   */
  it('opens the gate only when no list narrows it', () => {
    expect(emailIsPermitted('stranger@gmail.com', { ...closed, allowSignup: true })).toBe(true)

    const listed = { ...closed, allowSignup: true, allowedDomains: ['hasaki.vn'] }
    expect(emailIsPermitted('stranger@gmail.com', listed)).toBe(false)
    expect(emailIsPermitted('me@hasaki.vn', listed)).toBe(true)
  })

  it('rejects an empty or malformed address', () => {
    const policy = { ...closed, allowSignup: true, allowedDomains: ['x.com'] }
    expect(emailIsPermitted('', policy)).toBe(false)
    expect(emailIsPermitted('   ', policy)).toBe(false)
    expect(emailIsPermitted('no-at-sign', policy)).toBe(false)
  })
})
