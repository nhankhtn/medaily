import { z } from 'zod'

/**
 * Environment is parsed once, at import, but a bad configuration does **not**
 * throw here.
 *
 * A module-scope throw kills the whole module graph: the root layout never
 * evaluates, React has no tree to render, and the browser gets an opaque
 * minified Server Components error with nothing actionable in it. Instead the
 * issues are collected, `/api/health` names them, the shell falls back to
 * defaults so the sign-in page still renders, and any route that actually
 * needs the database fails lomedailyudly.
 *
 * Command-line entry points want the opposite — call `assertEnv()` there to
 * refuse to run at all (spec 26.1).
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Auth is a single hard-coded credential pair (spec 29). Absent values keep
  // the gate closed rather than open.
  AUTH_USERNAME: z.string().optional(),
  AUTH_PASSWORD: z.string().optional(),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 characters').optional(),
})

export type Env = z.infer<typeof envSchema>

const parsed = envSchema.safeParse(process.env)

/** Human-readable configuration problems, empty when the environment is valid. */
export const envIssues: string[] = parsed.success
  ? []
  : parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)

export const env: Env = parsed.success
  ? parsed.data
  : {
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      NODE_ENV: (process.env.NODE_ENV as Env['NODE_ENV']) ?? 'development',
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      AUTH_USERNAME: process.env.AUTH_USERNAME,
      AUTH_PASSWORD: process.env.AUTH_PASSWORD,
      AUTH_SECRET: process.env.AUTH_SECRET,
    }

// Read straight from process.env so this holds even when parsing failed.
export const isProduction = process.env.NODE_ENV === 'production'

/** Fail fast — for scripts, where a half-configured run is worse than no run. */
export function assertEnv(): void {
  if (envIssues.length === 0) return
  throw new Error(
    `Invalid environment configuration:\n${envIssues.map((issue) => `  - ${issue}`).join('\n')}`,
  )
}
