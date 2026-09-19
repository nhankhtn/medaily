import { describe, expect, it } from 'vitest'
import { readEvents, sseEvent, type ServerEvent } from '@/lib/sse'

/** A body that hands out exactly the chunks given, boundaries and all. */
function bodyOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

async function collect(chunks: string[]): Promise<ServerEvent[]> {
  const events: ServerEvent[] = []
  for await (const event of readEvents(bodyOf(chunks))) events.push(event)
  return events
}

describe('sseEvent', () => {
  it('writes an event a reader can read back', async () => {
    const [event] = await collect([sseEvent('step', { node: 'load' })])
    expect(event).toEqual({ event: 'step', data: '{"node":"load"}' })
  })
})

describe('readEvents', () => {
  it('reads several events out of one chunk', async () => {
    const events = await collect([
      'event: step\ndata: {"node":"route"}\n\nevent: step\ndata: {"node":"load"}\n\n',
    ])
    expect(events.map((event) => event.data)).toEqual(['{"node":"route"}', '{"node":"load"}'])
  })

  it('holds an event that arrives split across chunks', async () => {
    const events = await collect(['event: ans', 'wer\ndata: {"a":', '1}\n\n'])
    expect(events).toEqual([{ event: 'answer', data: '{"a":1}' }])
  })

  it('holds a character that arrives split across chunks', async () => {
    const whole = new TextEncoder().encode('event: a\ndata: "ừ"\n\n')
    const events: ServerEvent[] = []
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        // Straight through the two bytes of "ừ".
        controller.enqueue(whole.slice(0, 16))
        controller.enqueue(whole.slice(16))
        controller.close()
      },
    })
    for await (const event of readEvents(body)) events.push(event)
    expect(events).toEqual([{ event: 'a', data: '"ừ"' }])
  })

  it('names an event with no event line the way the spec does', async () => {
    expect(await collect(['data: hello\n\n'])).toEqual([{ event: 'message', data: 'hello' }])
  })

  it('joins the lines of a multi-line data field', async () => {
    expect(await collect(['event: a\ndata: one\ndata: two\n\n'])).toEqual([
      { event: 'a', data: 'one\ntwo' },
    ])
  })

  it('ignores a block with nothing in it', async () => {
    expect(await collect([': keep-alive\n\nevent: a\ndata: 1\n\n'])).toEqual([
      { event: 'a', data: '1' },
    ])
  })

  it('drops a last event that never got its blank line', async () => {
    expect(await collect(['event: a\ndata: 1\n\nevent: b\ndata: 2\n'])).toEqual([
      { event: 'a', data: '1' },
    ])
  })
})
