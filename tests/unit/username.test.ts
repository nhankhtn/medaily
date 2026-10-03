import { describe, expect, it } from 'vitest'
import { parseUsername, usernameFromEmail } from '@/lib/username'

describe('parseUsername', () => {
  it('keeps a handle and stores it in lowercase', () => {
    expect(parseUsername('  Ada_1 ')).toBe('ada_1')
  })

  it('takes a handle from the mailbox name', () => {
    expect(usernameFromEmail('Ada.Lane+tag@example.com')).toBe('adalanetag')
    expect(usernameFromEmail('ab@example.com')).toBeNull()
  })

  it('refuses a handle that is too short, starts with a number, or carries a space', () => {
    expect(parseUsername('ab')).toBeNull()
    expect(parseUsername('1ada')).toBeNull()
    expect(parseUsername('ada lane')).toBeNull()
    expect(parseUsername('ada@mail.com')).toBeNull()
  })
})
