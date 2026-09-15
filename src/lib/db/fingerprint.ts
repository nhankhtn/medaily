import { createHash } from 'node:crypto'

/**
 * A short, non-reversible name for *which* database a connection string points
 * at — host and database name, nothing else, hashed.
 *
 * `/api/health` is public, so it may not print an address. But "is the deploy
 * on the same database as my machine?" is a question worth answering, and it
 * was answered too late once: a migration was run against a local `.env.local`
 * that turned out not to be the production database, and the pages that needed
 * the new column went down.
 *
 * Two fingerprints being equal means the same database. Being different means
 * different — which is the whole job.
 */
export function databaseFingerprint(url: string | undefined): string | null {
  if (!url) return null

  try {
    const { host, pathname } = new URL(url)
    // The pooled and direct endpoints of one Neon database differ by a prefix
    // on the host; they are the same data, so the prefix is dropped.
    const plain = host.replace(/-pooler\./, '.')
    return createHash('sha256').update(`${plain}${pathname}`).digest('hex').slice(0, 8)
  } catch {
    return null
  }
}
