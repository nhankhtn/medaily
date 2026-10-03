import { describe, expect, it } from 'vitest'
import { escapeIcs } from '@/lib/calendar/ics'

describe('escapeIcs', () => {
  it('escapes the characters a calendar line would otherwise split on', () => {
    expect(escapeIcs('Hop mat; phong A')).toBe('Hop mat\\; phong A')
    expect(escapeIcs('a, b')).toBe('a\\, b')
    expect(escapeIcs('a\\b')).toBe('a\\\\b')
    expect(escapeIcs('xong\rSUMMARY:viec khac')).toBe('xong\\nSUMMARY:viec khac')
    expect(escapeIcs('dong 1\ndong 2')).toBe('dong 1\\ndong 2')
  })
})
