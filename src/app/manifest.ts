import type { MetadataRoute } from 'next'

/** Installable as a PWA (spec 22.3). The offline shell arrives with phase 7. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Personal OS',
    short_name: 'Personal OS',
    description: 'Track daily performance, understand behaviour, manage goals.',
    start_url: '/daily',
    display: 'standalone',
    background_color: '#fafafa',
    theme_color: '#4f5fd7',
    orientation: 'portrait',
    icons: [
      // One scalable file rather than a ladder of PNGs: every browser that can
      // install a PWA can rasterise SVG.
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }
}
