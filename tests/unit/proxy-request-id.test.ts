import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { REQUEST_ID_HEADER } from '@/lib/request-id'
import { proxy } from '@/proxy'

const get = (path: string, headers: Record<string, string> = {}) =>
  proxy(new NextRequest(`http://localhost${path}`, { headers }))

describe('the proxy stamps every request', () => {
  it('answers a public path with an id', async () => {
    const response = await get('/login')
    expect(response.headers.get(REQUEST_ID_HEADER)).toMatch(/^[0-9a-f]{8}$/)
  })

  it('keeps the id the caller sent', async () => {
    const response = await get('/login', { [REQUEST_ID_HEADER]: 'trace-abc-1' })
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe('trace-abc-1')
  })

  it("adopts Vercel's, so its logs and ours agree", async () => {
    const response = await get('/login', { 'x-vercel-id': 'sin1::iad1::pdx7q-1757' })
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe('pdx7q-1757')
  })

  it('stamps a request it turns away, which is the one you most want to trace', async () => {
    const response = await get('/calendar')
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
    expect(response.headers.get(REQUEST_ID_HEADER)).toMatch(/^[0-9a-f]{8}$/)
  })

  it('gives two requests two ids', async () => {
    const [a, b] = await Promise.all([get('/login'), get('/login')])
    expect(a.headers.get(REQUEST_ID_HEADER)).not.toBe(b.headers.get(REQUEST_ID_HEADER))
  })
})
