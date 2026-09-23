import { networkInterfaces } from 'node:os'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

/**
 * Phone-on-Wi-Fi hits the machine by LAN IP. Server Actions compare `Origin`
 * to `x-forwarded-host` and abort when they disagree — and iOS often sends
 * `Origin: null`. Allow those only for local/dev (never on Vercel).
 */
function localActionOrigins(): string[] {
  if (process.env.VERCEL) return []
  const hosts = new Set<string>(['localhost', '127.0.0.1', 'null'])
  for (const list of Object.values(networkInterfaces())) {
    for (const entry of list ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue
      hosts.add(entry.address)
    }
  }
  const origins: string[] = []
  for (const host of hosts) {
    origins.push(host)
    if (host !== 'null') origins.push(`${host}:3000`)
  }
  return origins
}

const lanOrigins = localActionOrigins()

const nextConfig: NextConfig = {
  /**
   * Standalone output is for the Docker image (spec 34). Vercel does its own
   * output tracing and looks for `.next/next-server.js.nft.json`, which
   * standalone mode does not leave there — setting it breaks the deploy.
   */
  output: process.env.VERCEL ? undefined : 'standalone',
  turbopack: { root: import.meta.dirname },
  poweredByHeader: false,
  reactStrictMode: true,
  // Dev assets / HMR when the page is opened as http://192.168.x.x:3000
  allowedDevOrigins: lanOrigins.filter((origin) => !origin.includes(':') && origin !== 'null'),
  experimental: {
    serverActions: {
      allowedOrigins: lanOrigins,
    },
  },
  async headers() {
    return [
      // Everything except the Firebase auth helper.
      {
        source: '/((?!__/auth(?:/|$)).*)',
        headers: securityHeaders,
      },
      // Auth helper is iframed and builds the Google OAuth URL — DENY / no-referrer
      // here breaks sign-in (blank iframe or Google 400 malformed).
      {
        source: '/__/auth/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
  async rewrites() {
    const project =
      process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? ''
    if (!project) return []

    return [
      {
        source: '/__/auth/:path*',
        destination: `https://${project}.firebaseapp.com/__/auth/:path*`,
      },
    ]
  },
}

export default withNextIntl(nextConfig)
