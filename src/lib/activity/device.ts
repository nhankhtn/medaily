/**
 * Which browser, on which system — read off the `user-agent` header.
 *
 * The header itself is not stored. It is long, it is a fingerprint, and it
 * answers a question nobody asks: what a person needs from a sign-in they do
 * not recognise is "Chrome trên Windows", because that is the sentence that
 * either matches a machine they own or does not.
 *
 * Deliberately shallow. A user-agent string is a pile of compatibility lies —
 * every browser claims to be Mozilla, Edge claims to be Chrome, Chrome claims
 * to be Safari — so this reads the few tokens that survive that, in the order
 * where the more specific claim wins, and answers `null` rather than guess.
 */

/** Order matters: each entry must be checked before the one it impersonates. */
const BROWSERS: [RegExp, string][] = [
  [/\bEdg(?:A|iOS)?\//, 'Edge'],
  [/\bOPR\/|\bOpera\//, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\bcoc_coc_browser\//i, 'Cốc Cốc'],
  [/\bFirefox\/|\bFxiOS\//, 'Firefox'],
  [/\bCriOS\//, 'Chrome'],
  [/\bChrome\//, 'Chrome'],
  [/\bSafari\//, 'Safari'],
]

const SYSTEMS: [RegExp, string][] = [
  // Before Mac: an iPad reports "Macintosh" in desktop mode, and iOS carries
  // "like Mac OS X" in every one of its user agents.
  [/\biPhone\b/, 'iPhone'],
  [/\biPad\b/, 'iPad'],
  [/\bAndroid\b/, 'Android'],
  [/\bWindows NT\b/, 'Windows'],
  [/\bMac OS X\b|\bMacintosh\b/, 'Mac'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bLinux\b/, 'Linux'],
]

/**
 * `Chrome · Windows`, or whichever half could be read, or `null` for a header
 * that is absent, empty or says nothing either list recognises. A row without
 * a device is better than a row asserting one that was guessed.
 */
export function describeDevice(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null

  const parts = [match(userAgent, BROWSERS), match(userAgent, SYSTEMS)].filter(
    (part): part is string => part !== null,
  )
  return parts.length > 0 ? parts.join(' · ') : null
}

function match(userAgent: string, table: [RegExp, string][]): string | null {
  for (const [pattern, name] of table) if (pattern.test(userAgent)) return name
  return null
}
