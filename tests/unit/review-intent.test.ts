import { describe, expect, it } from 'vitest'
import { classify } from '../../src/lib/reviews/intent'

const withAnswer = { hasAnswer: true, locale: 'vi' as const }
const noAnswer = { hasAnswer: false, locale: 'vi' as const }

describe('classify', () => {
  it('opens a period when nothing has been answered yet', () => {
    expect(classify('Tuần này', noAnswer)).toEqual({ kind: 'open' })
    expect(classify('tháng trước thì sao', noAnswer)).toEqual({ kind: 'open' })
  })

  it('treats anything else after an answer as a follow-up', () => {
    expect(classify('vì sao điểm thấp thế', withAnswer)).toEqual({ kind: 'follow_up' })
  })

  it('spots a request for advice in either language', () => {
    for (const message of [
      'Cho tôi vài gợi ý',
      'toi nen lam gi tiep',
      'bạn đề xuất gì không',
      'give me some suggestions',
      'what should i do next',
    ]) {
      expect(classify(message, withAnswer), message).toEqual({ kind: 'suggest' })
    }
  })

  it('asks for advice even before a period is open', () => {
    expect(classify('gợi ý cho tôi', noAnswer)).toEqual({ kind: 'suggest' })
  })

  it('routes a translation to the named language', () => {
    expect(classify('dịch sang tiếng Việt', withAnswer)).toEqual({
      kind: 'translate',
      target: 'vi',
    })
    expect(classify('dịch sang tiếng Anh', withAnswer)).toEqual({ kind: 'translate', target: 'en' })
    expect(classify('translate to english', withAnswer)).toEqual({
      kind: 'translate',
      target: 'en',
    })
  })

  it('translates into the reader own language when none is named', () => {
    expect(classify('dịch giúp tôi', withAnswer)).toEqual({ kind: 'translate', target: 'vi' })
    expect(classify('dịch giúp tôi', { hasAnswer: true, locale: 'en' })).toEqual({
      kind: 'translate',
      target: 'en',
    })
  })

  it('has nothing to translate before the first answer', () => {
    expect(classify('dịch sang tiếng Việt', noAnswer)).toEqual({ kind: 'open' })
  })

  it('does not read a pronoun as a language', () => {
    // "anh" is a pronoun far more often than it is English.
    expect(classify('dịch cho anh xem với', withAnswer)).toEqual({
      kind: 'translate',
      target: 'vi',
    })
  })

  it('works without tone marks', () => {
    expect(classify('dich sang tieng viet', withAnswer)).toEqual({
      kind: 'translate',
      target: 'vi',
    })
    expect(classify('goi y di', withAnswer)).toEqual({ kind: 'suggest' })
  })
})
