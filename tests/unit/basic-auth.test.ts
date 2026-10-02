import { describe, expect, it } from 'vitest'
import { basicCredentialsMatch } from '@/lib/auth/basic'
import type { AuthConfig } from '@/lib/auth/config'

const auth: AuthConfig = {
  username: 'me',
  password: 'pa:ss wörd',
  secret: 'x'.repeat(32),
  configured: true,
}

const basic = (user: string, password: string) =>
  `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`

describe('basicCredentialsMatch', () => {
  it('lets the configured account in, colons and accents included', () => {
    expect(basicCredentialsMatch(basic('me', 'pa:ss wörd'), auth)).toBe(true)
  })

  it('refuses a wrong username or password', () => {
    expect(basicCredentialsMatch(basic('you', 'pa:ss wörd'), auth)).toBe(false)
    expect(basicCredentialsMatch(basic('me', 'pa:ss'), auth)).toBe(false)
  })

  it('refuses a missing, malformed or non-Basic header', () => {
    expect(basicCredentialsMatch(null, auth)).toBe(false)
    expect(basicCredentialsMatch('Bearer abc', auth)).toBe(false)
    expect(basicCredentialsMatch('Basic !!!not-base64', auth)).toBe(false)
    expect(basicCredentialsMatch(`Basic ${Buffer.from('nocolon').toString('base64')}`, auth)).toBe(
      false,
    )
  })

  it('stays closed when the account is not configured', () => {
    expect(
      basicCredentialsMatch(basic('', ''), {
        ...auth,
        username: '',
        password: '',
        configured: false,
      }),
    ).toBe(false)
  })
})
