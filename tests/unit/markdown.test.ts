import { describe, expect, it } from 'vitest'
import { hasInlineMarkdown, hasMarkdown, lineStyle, lineInfo } from '@/lib/markdown'

describe('lineStyle', () => {
  it('reads the depth of a heading', () => {
    expect(lineStyle('# Hôm nay')).toBe('h1')
    expect(lineStyle('## Việc')).toBe('h2')
    expect(lineStyle('### Chi tiết')).toBe('h3')
    expect(lineStyle('#### Sâu hơn')).toBe('h3')
  })

  it('needs the space and the words a heading is made of', () => {
    expect(lineStyle('#abc')).toBeNull()
    expect(lineStyle('# ')).toBeNull()
    expect(lineStyle('bug #123 đã fix')).toBeNull()
  })

  it('tells a list from a sentence with a dash', () => {
    expect(lineStyle('- mua sữa')).toBe('bullet')
    expect(lineStyle('  * gọi mẹ')).toBe('bullet')
    expect(lineStyle('1. dậy sớm')).toBe('ordered')
    expect(lineStyle('2) rồi chạy')).toBe('ordered')
    expect(lineStyle('- [ ] chưa làm')).toBe('task')
    expect(lineStyle('- [x] xong')).toBe('task')
    expect(lineStyle('Họp từ 8-9h sáng')).toBeNull()
    expect(lineStyle('Chi phí — ăn trưa 55k')).toBeNull()
  })

  it('reads quotes, rules and fences', () => {
    expect(lineStyle('> câu đáng nhớ')).toBe('quote')
    expect(lineStyle('---')).toBe('rule')
    expect(lineStyle('* * *')).toBe('rule')
    expect(lineStyle('```ts')).toBe('code')
  })

  it('leaves a plain line plain', () => {
    expect(lineStyle('')).toBeNull()
    expect(lineStyle('hôm nay ổn')).toBeNull()
    expect(lineStyle('2 + 3 = 5')).toBeNull()
  })
})

describe('hasInlineMarkdown', () => {
  it('finds what the editor cannot dress in place', () => {
    expect(hasInlineMarkdown('xong **sớm** hơn')).toBe(true)
    expect(hasInlineMarkdown('chạy `pnpm dev`')).toBe(true)
    expect(hasInlineMarkdown('xem [ghi chú](https://example.com)')).toBe(true)
    expect(hasInlineMarkdown('nối sang [[Ghi chú kia]]')).toBe(true)
    expect(hasInlineMarkdown('| a | b |')).toBe(true)
  })

  it('does not count a line the editor already shows', () => {
    expect(hasInlineMarkdown('# Hôm nay')).toBe(false)
    expect(hasInlineMarkdown('- mua sữa')).toBe(false)
    expect(hasInlineMarkdown('> câu đáng nhớ')).toBe(false)
  })

  it('leaves prose and code-ish words alone', () => {
    expect(hasInlineMarkdown('Hôm nay mệt quá')).toBe(false)
    expect(hasInlineMarkdown('file snake_case_thing')).toBe(false)
    expect(hasInlineMarkdown('đánh giá 4*/5')).toBe(false)
    expect(hasInlineMarkdown(null)).toBe(false)
  })
})

describe('hasMarkdown', () => {
  it('is either kind', () => {
    expect(hasMarkdown('# Hôm nay')).toBe(true)
    expect(hasMarkdown('xong **sớm** hơn')).toBe(true)
    expect(hasMarkdown('Hôm nay mệt quá, ngủ có 5 tiếng')).toBe(false)
    expect(hasMarkdown('')).toBe(false)
    expect(hasMarkdown(undefined)).toBe(false)
  })
})

describe('lineInfo measures the marker so the editor can hide exactly it', () => {
  const marker = (line: string) => lineInfo(line).marker

  it('takes the hashes and the space after them, nothing else', () => {
    expect(marker('# Ba việc')).toBe('# ')
    expect(marker('###   spaced out')).toBe('###   ')
    expect(lineInfo('# Ba việc').label).toBe('')
  })

  it('leaves a bullet standing in for the dash', () => {
    expect(marker('- mua sữa')).toBe('- ')
    expect(lineInfo('- mua sữa').label).toBe('•')
    expect(marker('  * indented')).toBe('  * ')
  })

  it('shows the number that was typed, not one it counted itself', () => {
    expect(lineInfo('7) seventh').label).toBe('7.')
    expect(marker('7) seventh')).toBe('7) ')
  })

  it('reads a task as done or not from its box', () => {
    expect(lineInfo('- [ ] todo').label).toBe('☐')
    expect(lineInfo('- [x] done').label).toBe('☑')
    expect(marker('- [x] done')).toBe('- [x] ')
  })

  it('is the whole of a rule, since a border draws it instead', () => {
    expect(marker('---')).toBe('---')
    expect(lineInfo('---').style).toBe('rule')
  })

  it('leaves a code fence alone, so where the block ends stays visible', () => {
    expect(marker('```ts')).toBe('')
    expect(lineInfo('```ts').style).toBe('code')
  })

  it('measures nothing on a plain line', () => {
    expect(lineInfo('Xong **sớm** hơn')).toEqual({ style: null, marker: '', label: '' })
  })

  it('never claims a marker that is not one', () => {
    for (const line of ['#nohash', '#', '- ', 'a - b', '2026-09-16 là hôm nay']) {
      expect(marker(line)).toBe('')
    }
  })

  it('cuts the line exactly, so marker plus rest is the source again', () => {
    for (const line of ['# Ba việc', '- mua sữa', '3. thứ ba', '- [x] xong', '> trích']) {
      const { marker: mark } = lineInfo(line)
      expect(mark + line.slice(mark.length)).toBe(line)
    }
  })
})

describe('a heading survives a stray leading space', () => {
  it('allows up to three, the way Markdown does', () => {
    expect(lineStyle(' # abc')).toBe('h1')
    expect(lineStyle('   ## abc')).toBe('h2')
    expect(lineInfo(' # abc').marker).toBe(' # ')
  })

  it('stops at four, which is an indented code block', () => {
    expect(lineStyle('    # abc')).toBeNull()
  })
})
