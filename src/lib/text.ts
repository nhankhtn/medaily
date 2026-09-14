/**
 * Lowercase and strip accents, so "Ăn uống" matches "an uong" and "tuần
 * trước" matches "tuan truoc".
 *
 * Vietnamese tone marks are combining characters, which `NFD` separates out;
 * `đ` is not decomposable and is replaced on its own. Shared, because both the
 * category matcher and the period parser need the same folding, and matching
 * accented characters inside a regex character class quietly fails on the
 * tones — `[aâ]` does not cover `ầ`.
 */
export function foldText(value: string): string {
  return value
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}
