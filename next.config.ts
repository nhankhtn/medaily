import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

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
