'use client'

/**
 * Last resort: when the root layout itself throws, React cannot render the
 * normal error boundary, and a production build shows only a minified digest.
 * This page owns its own markup and styles — no i18n, no database, no shell —
 * and points at the one endpoint that explains what is actually wrong.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
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
            This is usually a missing environment variable or a database it cannot
            reach. Open <code>/api/health</code> — it names the missing
            configuration and the connection error.
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <a
              href="/api/health"
              style={{
                border: '1px solid #cfcfd6',
                borderRadius: '0.5rem',
                padding: '0.5rem 0.875rem',
                textDecoration: 'none',
                color: 'inherit',
                fontSize: '0.875rem',
              }}
            >
              Check /api/health
            </a>
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

          {error.digest ? (
            <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#8a8a94' }}>
              Digest {error.digest} — the full message is in the server logs.
            </p>
          ) : null}
        </main>
      </body>
    </html>
  )
}
