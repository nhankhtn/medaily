import { env } from '@/lib/env'
import { serviceClient, type ServiceClient } from '@/server/service-client'

/**
 * `medaily-ai`, the deploy that owns every call to a model.
 *
 * One place holds the key, the fallback chain between models and the prompts,
 * so a prompt is edited once and a quota is spent from one bucket. This app
 * sends what it knows about the person and renders what comes back.
 *
 * Server-side only. `AI_SERVICE_TOKEN` is a shared secret between the two
 * deploys and must never reach a browser, so every call goes out from a server
 * action or a route handler.
 *
 * Unconfigured, the features that need it are not offered rather than broken.
 */
export function aiServiceConfigured(): boolean {
  return Boolean(env.AI_SERVICE_URL && env.AI_SERVICE_TOKEN)
}

/**
 * Built per call rather than held: the configuration may be absent, and then
 * there is no client to hold. `name` is what an error says refused.
 */
export function aiClient(name: string, timeoutMs?: number): ServiceClient {
  return serviceClient({
    name,
    baseUrl: env.AI_SERVICE_URL as string,
    token: env.AI_SERVICE_TOKEN as string,
    timeoutMs,
  })
}
