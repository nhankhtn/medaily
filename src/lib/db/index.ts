import net from 'node:net'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env, isProduction } from '@/lib/env'
import * as schema from './schema'

declare global {
  var __medailySql: ReturnType<typeof postgres> | undefined
}

net.setDefaultAutoSelectFamilyAttemptTimeout?.(2000)

function createClient() {
  // An unset URL cannot throw here (see lib/env): the connection then fails at
  // query time, and `/api/health` reports `not_configured` before trying.
  return postgres(env.DATABASE_URL || 'postgres://unset@127.0.0.1:1/unset', {
    // The finance page asks for eleven things at once, and a pool smaller than
    // that turns one wave of queries into three. On a deploy that costs 14ms a
    // round trip nobody notices; from a laptop 250ms from the database it was a
    // measured second. Production keeps the smaller pool because every instance
    // holds its own, and there the second wave is not worth the extra sockets.
    max: isProduction ? 10 : 16,
    idle_timeout: 20,
    // Dev-mode slow query log (spec 30)
    debug: isProduction
      ? undefined
      : (_conn, query, params) => {
          if (process.env.MEDAILY_SQL_DEBUG) console.debug('[sql]', query, params)
        },
  })
}

export const sql = globalThis.__medailySql ?? createClient()
if (!isProduction) globalThis.__medailySql = sql

export const db = drizzle(sql, { schema })
export type Db = typeof db

/** A transaction handle, accepted anywhere a `Db` is, so services can compose. */
export type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0]
export type DbOrTx = Db | Transaction

export { schema }
