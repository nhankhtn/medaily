import { describe, expect, it } from 'vitest'
import { describeDevice } from '@/lib/activity/device'

/**
 * A user-agent string is a pile of compatibility lies, and the order these are
 * checked in is the whole of the logic. Every case here is a real header that
 * a naive check gets wrong: Edge says Chrome, Chrome says Safari, an iPhone
 * says Mac.
 */
describe('reading a device off a user agent', () => {
  it.each([
    [
      'Edge, which claims to be Chrome',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      'Edge · Windows',
    ],
    [
      'Chrome, which claims to be Safari',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Chrome · Windows',
    ],
    [
      'Safari on an iPhone, which claims to be a Mac',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Safari · iPhone',
    ],
    [
      'Chrome on iOS, which is Safari underneath and says CriOS',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
      'Chrome · iPhone',
    ],
    [
      'Chrome on Android',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      'Chrome · Android',
    ],
    [
      'Safari on a Mac',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      'Safari · Mac',
    ],
    [
      'Firefox on Linux',
      'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Firefox · Linux',
    ],
    [
      'Cốc Cốc, which is Chrome underneath',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 coc_coc_browser/120.0.0 Safari/537.36',
      'Cốc Cốc · Windows',
    ],
    [
      'Samsung Internet, which also claims to be Chrome',
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
      'Samsung Internet · Android',
    ],
  ])('reads %s', (_case, userAgent, expected) => {
    expect(describeDevice(userAgent)).toBe(expected)
  })

  it('says only what it could read', () => {
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0)')).toBe('Windows')
  })

  /** A guessed device is worse than none: it is a fact nobody can check. */
  it.each([[null], [undefined], [''], ['curl/8.4.0'], ['   ']])(
    'answers nothing for %j rather than guessing',
    (userAgent) => {
      expect(describeDevice(userAgent)).toBeNull()
    },
  )
})
