import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync('src/server/actions/chat.ts', 'utf8')

/**
 * Every other table in this app is protected by `WHERE user_id = $1` sitting
 * inside the query itself, so forgetting it is hard. A room belongs to several
 * people, so the check moved out of the query and into a line somebody has to
 * remember to write — which means a test has to remember for them.
 *
 * Reading the source is crude and it is the point: it catches the action added
 * next month by somebody who copied the wrong one.
 */
describe('every chat action checks who is asking', () => {
  /**
   * Split on the exports rather than matching a shape.
   *
   * The first version of this matched `export async function name(...)`, and
   * it quietly stopped checking four actions the day they were wrapped in
   * `audited(...)` — a guard that goes blind is worse than no guard, because
   * it keeps reporting success. So the names are found first and the body is
   * whatever lies between one export and the next, whatever form it takes.
   */
  const names = [...source.matchAll(/^export (?:async function|const) (\w+)/gm)].map(
    (match) => match[1] ?? '',
  )
  const bodies = names.map((name, index) => {
    const start = source.search(new RegExp(`^export (?:async function|const) ${name}\\b`, 'm'))
    const next = names[index + 1]
    const end =
      next === undefined
        ? source.length
        : source.search(new RegExp(`^export (?:async function|const) ${next}\\b`, 'm'))
    return [name, source.slice(start, end)] as [string, string]
  })

  /** These decide membership rather than depend on it. */
  const entryPoints = new Set(['createRoom', 'openDirectRoom', 'acceptInvite'])

  it('checks every exported action, whatever shape it is written in', () => {
    const exported = source.match(/^export (?:async function|const) \w+/gm) ?? []
    expect(bodies).toHaveLength(exported.length)
    expect(bodies.length).toBeGreaterThan(8)
  })

  it.each(bodies)('%s refuses somebody who is not in the room', (name, body) => {
    if (entryPoints.has(name)) return
    expect(body, `${name} must call assertMember or assertCanInvite`).toMatch(
      /assertMember|assertCanInvite|allowed\(/,
    )
  })

  /** A guard that runs after the read has already happened is not a guard. */
  it.each(bodies)('%s checks before it touches the store', (name, body) => {
    if (entryPoints.has(name)) return
    const guard = body.search(/assertMember|assertCanInvite|allowed\(/)
    const read = body.search(/store\.(list|find|append|soft|mark|touch|create|add|use)/)
    if (read === -1) return
    expect(guard, `${name} reads before it checks`).toBeLessThan(read)
  })

  /**
   * The entry points are the ones that cannot ask "are you in this room" —
   * they are how somebody gets in. They must still be doing *something* about
   * who is asking.
   */
  it.each([...entryPoints])('%s still reads the session', (name) => {
    const body = bodies.find(([found]) => found === name)?.[1] ?? ''
    expect(body).toContain('getCurrentUserId()')
  })

  it('never trusts a user id that arrived in the request', () => {
    // `withUserId` is the person you are opening a conversation *with*, never
    // the person you are claiming to be.
    const claims = source.match(/userId:\s*(?:parsed|input)\.data\.userId/g) ?? []
    expect(claims).toEqual([])
  })
})
