import { foldText } from '@/lib/text'

/**
 * What a message in the review chat is asking for, decided before anything is
 * sent anywhere.
 *
 * Deterministic on purpose. Classifying with a model would cost a round trip
 * and a second chance to be wrong, to answer a question a handful of phrases
 * already settle — the same reasoning that keeps the period parser a regex.
 * Anything unrecognised falls through to a normal question, which is the safe
 * default: the worst case is the answer the app gave before this file existed.
 */
export type ReviewIntent =
  /** Rewrite the answer already on screen in another language. */
  | { kind: 'translate'; target: 'en' | 'vi' }
  /** Advice, which the reviewer withholds until it is asked for. */
  | { kind: 'suggest' }
  /** Open a period and write its review. */
  | { kind: 'open' }
  /** Any other question about the period already open. */
  | { kind: 'follow_up' }

const TRANSLATE = /\b(dich|translate)\b|viet lai bang|say (that|this) in/
// Anchored on "tiếng"/"sang"/"ra": folded, a bare `viet` is also "viết".
const TO_VIETNAMESE = /tieng viet|vietnamese|(sang|qua|ra) viet/
// Likewise a bare `anh` is a pronoun far more often than a language.
const TO_ENGLISH = /tieng anh|english|(sang|qua|ra) anh/

const SUGGEST =
  /goi y|de xuat|khuyen|nen lam gi|lam gi tiep|toi nen|suggest|advice|advise|recommend|what should i/

export function classify(
  message: string,
  { hasAnswer, locale }: { hasAnswer: boolean; locale: 'en' | 'vi' },
): ReviewIntent {
  const folded = foldText(message)

  // Translation acts on the answer on screen, so it means nothing without one.
  if (hasAnswer && TRANSLATE.test(folded)) {
    // "dịch sang tiếng Anh" names its target; a bare "dịch nó đi" means the
    // language this person reads the app in.
    if (TO_VIETNAMESE.test(folded)) return { kind: 'translate', target: 'vi' }
    if (TO_ENGLISH.test(folded)) return { kind: 'translate', target: 'en' }
    return { kind: 'translate', target: locale }
  }

  if (SUGGEST.test(folded)) return { kind: 'suggest' }

  return hasAnswer ? { kind: 'follow_up' } : { kind: 'open' }
}
