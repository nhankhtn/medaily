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
    // Stated rather than inferred. It defaults to the directory `start_url`
    // sits in, so moving the start page one level down would quietly drop
    // every other screen out of the installed app and into a browser tab.
    scope: '/',
    icons: [
      // One scalable file rather than a ladder of PNGs: every browser that can
      // install a PWA can rasterise SVG.
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      // Android masks the icon to the launcher's shape. Without a maskable
      // one it letterboxes ours inside a white tile instead, which is the
      // look that marks an installed web app out from the real apps.
      {
        src: '/icon-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
