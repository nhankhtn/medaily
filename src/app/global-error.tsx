'use client'

import { useEffect } from 'react'

/**
 * Last resort: when the root layout itself throws, React cannot render the
 * normal error boundary, and a production build shows only a minified digest.
 * This page owns its own markup and styles — no i18n, no database, no shell.
 *
 * What went wrong goes to the console, not on screen: whoever can fix it is
 * reading the console, and whoever cannot is only being alarmed by it.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(
      `[app] the root layout failed${error.digest ? ` (digest ${error.digest})` : ''};`,
      'open /api/health for the cause:',
      error,
    )
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fafafa',
          color: '#1c1c22',
          padding: '2rem',
        }}
      >
        <main style={{ maxWidth: '32rem' }}>
          <h1 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem' }}>
            The app could not start
          </h1>
          <p style={{ margin: '0 0 1rem', lineHeight: 1.5, color: '#55555f' }}>
            Try again in a moment.
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={reset}
              style={{
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.5rem 0.875rem',
                background: '#4f5fd7',
                color: 'white',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>

        </main>
      </body>
    </html>
  )
}
