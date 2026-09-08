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
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default withNextIntl(nextConfig)
