import BrowserOnly from '@docusaurus/BrowserOnly'
import { useEffect, useMemo, useState } from 'react'
import styles from './ApiTry.module.css'

/**
 * An endpoint you can call from the page that documents it.
 *
 * These docs are served from the app's own origin, behind the same lock, so a
 * `fetch` from here reaches the real API with no proxy and no CORS. That is
 * the whole reason this is worth having: the curl in a document is a thing you
 * copy, adapt, and get wrong once; this is the same call with the fields in
 * front of you.
 *
 * It calls **production**, or whatever origin you are reading this on. Nothing
 * here is a sandbox.
 */
export type ApiTryProps = {
  method: 'GET' | 'POST'
  path: string
  /** Prefilled, and editable on the page. */
  body?: Record<string, unknown>
  /** A bearer token field is shown and remembered for the tab only. */
  bearer?: boolean
  /** Shown in red above the button, for a call that changes something. */
  warning?: string
}

export default function ApiTry(props: ApiTryProps) {
  // Docusaurus renders every page at build time, where there is no origin to
  // default to and no storage to read the token from.
  return <BrowserOnly>{() => <Caller {...props} />}</BrowserOnly>
}

/** Per tab, never written to disk: a token in localStorage outlives the reason to hold it. */
const TOKEN_KEY = 'medaily-docs-token'

function Caller({ method, path, body, bearer, warning }: ApiTryProps) {
  const [origin, setOrigin] = useState('')
  const [token, setToken] = useState('')
  const [text, setText] = useState(() => (body ? JSON.stringify(withId(body), null, 2) : ''))
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ status: number; body: string } | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
    try {
      setToken(sessionStorage.getItem(TOKEN_KEY) ?? '')
    } catch {
      /* private window, or storage refused */
    }
  }, [])

  const remember = (value: string) => {
    setToken(value)
    try {
      if (value) sessionStorage.setItem(TOKEN_KEY, value)
      else sessionStorage.removeItem(TOKEN_KEY)
    } catch {
      /* the field still works for this call */
    }
  }

  const curl = useMemo(
    () =>
      [
        `curl -X ${method} ${origin}${path}`,
        bearer ? `  -H "Authorization: Bearer ${token || '<token>'}"` : null,
        text ? `  -H "content-type: application/json"` : null,
        text ? `  -d '${text.replace(/\s*\n\s*/g, '')}'` : null,
      ]
        .filter(Boolean)
        .join(' \\\n'),
    [method, origin, path, bearer, token, text],
  )

  const call = async () => {
    if (warning && !window.confirm(`${warning}\n\nCall it anyway?`)) return

    setBusy(true)
    setResult(null)
    try {
      const response = await fetch(path, {
        method,
        headers: {
          ...(bearer ? { authorization: `Bearer ${token}` } : {}),
          ...(text ? { 'content-type': 'application/json' } : {}),
        },
        ...(text ? { body: text } : {}),
      })
      setResult({ status: response.status, body: await response.text() })
    } catch (error) {
      setResult({ status: 0, body: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.box}>
      <p className={styles.endpoint}>
        <span className={styles.method}>{method}</span>
        {origin}
        {path}
      </p>

      {bearer ? (
        <label className={styles.field}>
          <span>Token</span>
          <input
            type="password"
            value={token}
            onChange={(event) => remember(event.target.value)}
            placeholder="paste the grant token"
            autoComplete="off"
          />
        </label>
      ) : null}

      {body ? (
        <label className={styles.field}>
          <span>
            Body
            <button type="button" className={styles.small} onClick={() => setText(JSON.stringify(withId(body), null, 2))}>
              reset, new clientId
            </button>
          </span>
          <textarea rows={8} value={text} onChange={(event) => setText(event.target.value)} spellCheck={false} />
        </label>
      ) : null}

      <details className={styles.curl}>
        <summary>The same call as curl</summary>
        <pre>{curl}</pre>
        <button type="button" className={styles.small} onClick={() => void navigator.clipboard.writeText(curl)}>
          copy
        </button>
      </details>

      {warning ? <p className={styles.warning}>{warning}</p> : null}

      <button type="button" className={styles.call} disabled={busy} onClick={() => void call()}>
        {busy ? 'Calling…' : `Call ${method} ${path}`}
      </button>

      {result ? (
        <pre className={result.status >= 200 && result.status < 300 ? styles.ok : styles.bad}>
          {result.status === 0 ? 'Could not reach it' : `HTTP ${result.status}`}
          {'\n'}
          {pretty(result.body)}
        </pre>
      ) : null}
    </div>
  )
}

/**
 * A fresh `clientId` each time the body is reset.
 *
 * The id is the row's primary key, which is what makes a retry file once — so
 * calling twice with the same one answers `ok` and writes nothing, and reading
 * that as "it worked" twice is the mistake this avoids.
 */
function withId(body: Record<string, unknown>): Record<string, unknown> {
  return 'clientId' in body ? { ...body, clientId: crypto.randomUUID() } : body
}

function pretty(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body.slice(0, 2000)
  }
}
