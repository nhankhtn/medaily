import { describe, expect, it } from 'vitest'
import { MIN_QUERY_LENGTH, SEARCH_LIMIT, plainSnippet } from '@/lib/search'

describe('plainSnippet', () => {
  it('keeps the words and drops the markdown', () => {
    expect(
      plainSnippet('## Sở thích\n- Cà phê **sữa đá**, không đường\n- Thích phim của *Studio Ghibli*'),
    ).toBe('Sở thích Cà phê sữa đá, không đường Thích phim của Studio Ghibli')
  })

  it('unwraps a link to its text', () => {
    expect(plainSnippet('nghe [Playlist](https://example.com/x) này')).toBe('nghe Playlist này')
    expect(plainSnippet('![ảnh](/a.png) xong')).toBe('ảnh xong')
  })

  it('drops a fenced code block rather than showing it', () => {
    expect(plainSnippet('trước\n```ts\nconst a = 1\n```\nsau')).toBe('trước sau')
  })

  it('unwraps inline code and quotes', () => {
    expect(plainSnippet('chạy `pnpm dev`\n> ghi chú')).toBe('chạy pnpm dev ghi chú')
  })

  it('strips a numbered list marker', () => {
    expect(plainSnippet('1. Dị ứng hải sản\n2. Kỷ niệm')).toBe('Dị ứng hải sản Kỷ niệm')
  })

  it('gives back nothing when there was nothing but syntax', () => {
    expect(plainSnippet('### \n---')).toBe('---')
    expect(plainSnippet('')).toBeNull()
    expect(plainSnippet(null)).toBeNull()
  })
})

describe('the shared search limits', () => {
  it('refuses a one-character query', () => {
    expect(MIN_QUERY_LENGTH).toBeGreaterThan(1)
  })

  it('asks for more than one screenful, and still stops', () => {
    expect(SEARCH_LIMIT).toBeGreaterThan(8)
    expect(SEARCH_LIMIT).toBeLessThanOrEqual(50)
  })
})
