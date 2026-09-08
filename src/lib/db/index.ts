import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env, isProduction } from '@/lib/env'
import * as schema from './schema'

declare global {
  var __medailySql: ReturnType<typeof postgres> | undefined
}

function createClient() {
  return postgres(env.DATABASE_URL, {
    max: isProduction ? 10 : 5,
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
