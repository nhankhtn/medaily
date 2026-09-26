import { describe, expect, it } from 'vitest'

/**
 * The ledger's order, kept in one place because two things must agree on it:
 * the page query sorts by `occurred_on DESC, created_at DESC, id DESC`, and
 * the keyset cursor steps through that same triple. A row the client puts
 * back by hand — an edit saved, a delete undone — has to land where the next
 * page boundary expects it.
 */
const newestFirst = (
  a: { occurredOn: string; createdAt: Date; id: string },
  b: { occurredOn: string; createdAt: Date; id: string },
) =>
  b.occurredOn.localeCompare(a.occurredOn) ||
  b.createdAt.getTime() - a.createdAt.getTime() ||
  b.id.localeCompare(a.id)

const row = (occurredOn: string, createdAt: string, id: string) => ({
  occurredOn,
  createdAt: new Date(createdAt),
  id,
})

describe('the order the ledger pages in', () => {
  it('puts the newest day first, whatever time the rows were entered', () => {
    const sorted = [
      row('2026-09-01', '2026-09-26T10:00:00Z', 'a'),
      row('2026-09-26', '2026-09-01T10:00:00Z', 'b'),
    ].sort(newestFirst)
    expect(sorted.map((r) => r.id)).toEqual(['b', 'a'])
  })

  /*
   * The whole reason `created_at` is in there. Ids are random uuids, so a day
   * ordered by id alone drops a transaction just typed wherever its bytes
   * happen to fall — which is what someone sees as it "jumping down the list".
   */
  it('puts the one just entered at the top of its day', () => {
    const sorted = [
      row('2026-09-26', '2026-09-26T08:00:00Z', 'zzzzzzzz-0000-4000-8000-000000000000'),
      row('2026-09-26', '2026-09-26T09:00:00Z', 'aaaaaaaa-0000-4000-8000-000000000000'),
    ].sort(newestFirst)
    expect(sorted[0]!.createdAt.toISOString()).toBe('2026-09-26T09:00:00.000Z')
  })

  it('falls back to the id when the instant is identical', () => {
    const sorted = [
      row('2026-09-26', '2026-09-26T08:00:00Z', 'aaa'),
      row('2026-09-26', '2026-09-26T08:00:00Z', 'zzz'),
    ].sort(newestFirst)
    expect(sorted.map((r) => r.id)).toEqual(['zzz', 'aaa'])
  })

  it('leaves no pair undecided, so paging cannot skip or repeat a row', () => {
    const rows = [
      row('2026-09-26', '2026-09-26T08:00:00Z', 'b'),
      row('2026-09-26', '2026-09-26T08:00:00Z', 'a'),
      row('2026-09-26', '2026-09-26T09:00:00Z', 'c'),
      row('2026-09-25', '2026-09-26T10:00:00Z', 'd'),
    ]
    for (const left of rows) {
      for (const right of rows) {
        if (left === right) continue
        expect(newestFirst(left, right)).not.toBe(0)
      }
    }
  })
})
