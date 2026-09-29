import { describe, expect, it } from 'vitest'
import { describeLocation, signInSnapshot } from '@/lib/activity/sign-in'

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const headers = (entries: Record<string, string>) => new Headers(entries)

describe('where a sign-in came from', () => {
  it('names the city and the country', () => {
    expect(
      describeLocation(headers({ 'x-vercel-ip-country': 'VN', 'x-vercel-ip-city': 'Hanoi' })),
    ).toBe('Hanoi, VN')
  })

  /** Vercel percent-encodes it, so a two-word city arrives as one token. */
  it('decodes a city with a space in it', () => {
    expect(
      describeLocation(
        headers({ 'x-vercel-ip-country': 'VN', 'x-vercel-ip-city': 'Ho%20Chi%20Minh%20City' }),
      ),
    ).toBe('Ho Chi Minh City, VN')
  })

  it('settles for the country when there is no city', () => {
    expect(describeLocation(headers({ 'x-vercel-ip-country': 'vn' }))).toBe('VN')
  })

  /**
   * Nothing but Vercel sets these, so locally and behind another host the row
   * has no place on it rather than a wrong one.
   */
  it('answers nothing where the headers are absent', () => {
    expect(describeLocation(headers({}))).toBeNull()
  })

  /**
   * A request that reaches the origin directly carries whatever headers its
   * sender wrote, and this string is rendered back to a person as a fact about
   * their own account.
   */
  it.each([
    ['a country that is not a country code', { 'x-vercel-ip-country': 'Vietnam' }],
    ['an empty country', { 'x-vercel-ip-country': '' }],
    ['a country made of markup', { 'x-vercel-ip-country': '<b>' }],
  ])('refuses %s', (_case, entries) => {
    expect(describeLocation(headers(entries))).toBeNull()
  })

  it('strips markup out of a city rather than showing it', () => {
    expect(
      describeLocation(
        headers({ 'x-vercel-ip-country': 'VN', 'x-vercel-ip-city': '<script>Hanoi' }),
      ),
    ).toBe('scriptHanoi, VN')
  })

  it('cuts a city long enough to be a payload rather than a name', () => {
    const long = 'a'.repeat(500)
    const place = describeLocation(
      headers({ 'x-vercel-ip-country': 'VN', 'x-vercel-ip-city': long }),
    )
    expect(place).toHaveLength(60 + ', VN'.length)
  })
})

describe('what a sign-in writes down', () => {
  it('carries the device and the place together', () => {
    expect(
      signInSnapshot(
        headers({
          'user-agent': CHROME_WINDOWS,
          'x-vercel-ip-country': 'VN',
          'x-vercel-ip-city': 'Hanoi',
        }),
      ),
    ).toEqual({ device: 'Chrome · Windows', location: 'Hanoi, VN' })
  })

  it('carries the device alone off Vercel, where no place is known', () => {
    expect(signInSnapshot(headers({ 'user-agent': CHROME_WINDOWS }))).toEqual({
      device: 'Chrome · Windows',
    })
  })

  /** Never the raw header: it is long, and it is a fingerprint. */
  it('does not keep the user-agent string it was given', () => {
    const snapshot = signInSnapshot(headers({ 'user-agent': CHROME_WINDOWS }))
    expect(JSON.stringify(snapshot)).not.toContain('AppleWebKit')
  })

  it('answers nothing when the request said nothing about itself', () => {
    expect(signInSnapshot(headers({}))).toBeNull()
  })
})
