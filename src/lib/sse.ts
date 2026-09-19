/**
 * Server-sent events, read as they arrive and written the same way.
 *
 * Not `EventSource`: that only does GET, and a question is a POST. This reads
 * the body of an ordinary `fetch` instead, which works on both sides of the
 * wire — the route handler reads the agent service with it, the browser reads
 * the route handler with it.
 *
 * Only the two fields our own services send are understood. No `id`, no
 * `retry`, no reconnection.
 */
export type ServerEvent = { event: string; data: string }

export function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ServerEvent> {
  const reader = body.getReader()
  // A chunk can split a character as easily as it splits an event, so the
  // decoder keeps its own tail too.
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      // A blank line ends an event, and a chunk boundary can fall anywhere —
      // including inside one, which is why the tail is kept for the next read.
      let end = buffer.indexOf('\n\n')
      while (end !== -1) {
        const block = parseBlock(buffer.slice(0, end))
        buffer = buffer.slice(end + 2)
        if (block) yield block
        end = buffer.indexOf('\n\n')
      }
    }
  } finally {
    // Cancel rather than release: a caller that stops early wants the
    // connection behind this closed, not left open with nobody reading it.
    await reader.cancel().catch(() => {})
  }
}

function parseBlock(block: string): ServerEvent | null {
  let event = 'message'
  const data: string[] = []

  for (const line of block.split('\n')) {
    const clean = line.replace(/\r$/, '')
    if (clean.startsWith('event:')) event = clean.slice(6).trim()
    else if (clean.startsWith('data:')) data.push(clean.slice(5).replace(/^ /, ''))
  }

  return data.length > 0 ? { event, data: data.join('\n') } : null
}
