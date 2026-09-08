import { z } from 'zod'

/**
 * Environment is parsed once, at boot, and the process refuses to start when a
 * required variable is missing (spec 26.1).
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

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
  throw new Error(`Invalid environment configuration:\n${issues}`)
}

export const env = parsed.data
export const isProduction = env.NODE_ENV === 'production'
