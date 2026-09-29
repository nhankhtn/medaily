import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * `.env.example` is the only place anyone finds out a variable exists.
 *
 * This is written from a real afternoon lost: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
 * was read by One Tap, commented out in this file and absent from the schema,
 * so the feature switched itself off and nothing anywhere said why. A variable
 * the app reads and the example does not name is a feature nobody can turn on.
 */
const example = readFileSync('.env.example', 'utf8')
const schema = readFileSync('src/lib/env.ts', 'utf8')

/** Only a line that actually sets something; a commented sample is not one. */
const declared = new Set(
  example
    .split('\n')
    .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
    .map((line) => line.slice(0, line.indexOf('='))),
)

const validated = (schema.match(/^ {2}([A-Z][A-Z0-9_]*):/gm) ?? []).map((line) =>
  line.trim().replace(':', ''),
)

describe('the example environment file', () => {
  it('names every variable the schema validates', () => {
    expect(validated.filter((name) => !declared.has(name))).toEqual([])
  })

  it('names nothing the schema has never heard of', () => {
    expect([...declared].filter((name) => !validated.includes(name))).toEqual([])
  })

  /**
   * A commented `NAME=value` is a sample showing the format, and those earn
   * their place. It becomes a trap the moment the real line is missing: the
   * variable then exists only as prose, which is exactly how One Tap came to
   * be unreachable. So every name a comment mentions must also be set for
   * real somewhere below it.
   */
  it('has a real line for every variable its comments show a sample of', () => {
    const sampled = example
      .split('\n')
      .filter((line) => /^#\s*[A-Z][A-Z0-9_]*=/.test(line))
      .map((line) => line.replace(/^#\s*/, '').split('=')[0] ?? '')

    expect(sampled.filter((name) => !declared.has(name))).toEqual([])
  })
})
