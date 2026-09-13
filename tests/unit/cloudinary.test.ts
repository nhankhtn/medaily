import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { deliveryUrl, folderFor, signParams } from '@/lib/media/cloudinary'

describe('folder layout', () => {
  it('files an asset under owner and kind, so a second kind needs no rethink', () => {
    expect(folderFor('medaily', 'people', 'user-1', 'person-9')).toBe(
      'medaily/user-1/people/person-9',
    )
  })

  it('honours a configured base folder', () => {
    expect(folderFor('staging', 'people', 'u', 'p')).toBe('staging/u/people/p')
  })
})

describe('upload signature', () => {
  it('signs the sorted parameters followed by the secret', () => {
    const expected = createHash('sha1')
      .update('folder=medaily/u/people/p&timestamp=1700000000secret')
      .digest('hex')

    expect(signParams({ timestamp: 1700000000, folder: 'medaily/u/people/p' }, 'secret')).toBe(
      expected,
    )
  })

  it('does not depend on the order the parameters were written in', () => {
    const a = signParams({ timestamp: 1, folder: 'f', public_id: 'x' }, 's')
    const b = signParams({ public_id: 'x', folder: 'f', timestamp: 1 }, 's')
    expect(a).toBe(b)
  })

  it('changes when any parameter changes', () => {
    const base = signParams({ folder: 'f', timestamp: 1 }, 's')
    expect(signParams({ folder: 'f', timestamp: 2 }, 's')).not.toBe(base)
    expect(signParams({ folder: 'g', timestamp: 1 }, 's')).not.toBe(base)
    expect(signParams({ folder: 'f', timestamp: 1 }, 'other')).not.toBe(base)
  })
})

describe('delivery URLs', () => {
  const publicId = 'medaily/u/people/p/abc123'

  it('asks for a small, cheap image for the grid', () => {
    const url = deliveryUrl('demo', publicId, 'thumb')
    expect(url).toContain('q_auto:eco')
    expect(url).toContain('w_400')
    expect(url).toContain(publicId)
  })

  it('asks for a large, good one when the photo is opened', () => {
    const url = deliveryUrl('demo', publicId, 'full')
    expect(url).toContain('q_auto:good')
    expect(url).toContain('w_2000')
  })

  it('never serves the full size to a thumbnail', () => {
    expect(deliveryUrl('demo', publicId, 'thumb')).not.toBe(deliveryUrl('demo', publicId, 'full'))
  })

  it('lets the browser pick the format', () => {
    expect(deliveryUrl('demo', publicId)).toContain('f_auto')
  })
})
